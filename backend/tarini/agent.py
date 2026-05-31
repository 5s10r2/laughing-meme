"""
Anthropic API agent — streams Claude responses with tool-use loop.

stream_chat(session_id, user_message, history) is the single entry point.
It yields SSE-ready dicts including:
  - {"type": "text", "text": "..."}         — text chunk
  - {"type": "tool_start", ...}             — tool execution beginning
  - {"type": "tool_complete", ...}          — tool execution finished
  - {"type": "component", ...}             — UI component to render
  - {"type": "state_snapshot", ...}        — full state update for frontend
  - {"type": "done"}                       — stream end
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncIterator

import anthropic

from tarini.db import client as db
from tarini.prompts import (
    INITIAL_PROMPT,
    INITIAL_PROMPT_V2,
    load_system_prompt,
    load_system_prompt_v2,
    render_live_context,
)
from tarini.stage_ui import build_transition_event
from tarini.tools import TOOL_DEFINITIONS, execute_tool
from tarini.tools.ui import validate_emit_ui

# Redesigned-backend path (gated behind USE_NEW_EXPERIENCE) ------------------
from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.adapters.inmemory_tree_repository import InMemoryTreeRepository
from tarini.adapters.supabase_repository import SupabasePropertyRepository
from tarini.adapters.supabase_tree_repository import SupabaseTreeRepository
from tarini.application.command_service import CommandService
from tarini.application.tree_command_service import TreeCommandService
from tarini.flags import ui_components_enabled, use_new_experience, use_tree_model
from tarini.tools.agent_tools import TOOL_DEFINITIONS_V2, TOOL_DEFINITIONS_V2_TREE, execute_agent_tool
from tarini.blueprint import blueprint_props, is_blueprint_component
from tarini import tree_adapter
from tarini.ui_adapter import to_legacy_session_snapshot

logger = logging.getLogger(__name__)

MODEL = os.environ.get("MODEL_NAME", "claude-sonnet-4-20250514")
MAX_TOOL_ROUNDS = 10  # safety limit to prevent infinite tool loops
_MAX_API_HISTORY = 20  # ~5 tool-use turns of context for the API call
_STREAM_TIMEOUT = 60  # seconds — max time for a single Anthropic stream call

# Lazy singleton — initialized on first use so env vars are available
_client: anthropic.AsyncAnthropic | None = None


def _get_anthropic_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


# ---------------------------------------------------------------------------
# Sliding window — keeps API costs bounded
# ---------------------------------------------------------------------------

def _trim_history_for_api(history: list[dict]) -> list[dict]:
    """Return a trimmed copy of history for the API call.

    The full history stays intact in SessionManager for Supabase persistence.
    get_state provides all captured property data, so old conversation turns
    are redundant — the state IS the memory.

    Ensures the trimmed window:
    1. Starts with a 'user' message (API rejects assistant-first)
    2. Does NOT start with a tool_result (which references a tool_use in a
       prior assistant message that may have been trimmed away)
    """
    if len(history) <= _MAX_API_HISTORY:
        return history
    trimmed = history[-_MAX_API_HISTORY:]
    # Walk forward past any assistant messages or tool_result user messages
    while trimmed and not _is_plain_user_message(trimmed[0]):
        trimmed = trimmed[1:]
    return trimmed or history[-2:]  # fallback: at least last exchange


def _is_plain_user_message(msg: dict) -> bool:
    """Check if a message is a plain user message (not a tool_result)."""
    if msg.get("role") != "user":
        return False
    content = msg.get("content")
    # Plain text user message
    if isinstance(content, str):
        return True
    # List content — check it's not tool_result blocks
    if isinstance(content, list):
        return not any(
            isinstance(block, dict) and block.get("type") == "tool_result"
            for block in content
        )
    return False


# ---------------------------------------------------------------------------
# Tool description mapping for user-friendly tool_start messages
# ---------------------------------------------------------------------------

_TOOL_DESCRIPTIONS = {
    "get_state": "Checking your progress...",
    "update_state": "Saving your information...",
    "advance_stage": "Moving to the next stage...",
    "emit_ui": None,  # emit_ui is handled specially — no tool indicator shown
}


async def stream_chat(
    session_id: str,
    user_message: str,
    history: list[dict],
) -> AsyncIterator[dict]:
    """
    Send a message to Claude and stream the response, handling tool use.

    Args:
        session_id: Session UUID for tool dispatch.
        user_message: The user's message text.
        history: Mutable list of conversation messages (updated in-place).

    Yields:
        SSE event dicts with various types (text, tool_start, tool_complete,
        component, state_snapshot, done, etc.)
    """
    # Redesigned backend, gated. When off (default) the legacy path below runs unchanged.
    if use_new_experience():
        async for event in _stream_chat_v2(session_id, user_message, history):
            yield event
        return

    client = _get_anthropic_client()
    system_prompt = load_system_prompt()

    # Add the user message to history
    history.append({"role": "user", "content": user_message})

    for _round in range(MAX_TOOL_ROUNDS):
        # Trim history for the API call (full history stays intact for persistence)
        api_history = _trim_history_for_api(history)

        logger.info(
            "[stream_chat] round %d for session %s (%d messages, %d sent to API)",
            _round, session_id, len(history), len(api_history),
        )

        try:
            async with asyncio.timeout(_STREAM_TIMEOUT):
                async with client.messages.stream(
                    model=MODEL,
                    max_tokens=4096,
                    system=[{
                        "type": "text",
                        "text": system_prompt + _chat_only_suffix(),
                        "cache_control": {"type": "ephemeral"},
                    }],
                    messages=api_history,
                    tools=_select_tools(TOOL_DEFINITIONS),
                ) as stream:
                    async for event in stream:
                        if event.type == "content_block_delta":
                            if event.delta.type == "text_delta":
                                yield {"type": "text", "text": event.delta.text}

                    # Get the final message to check for tool use
                    final_message = await stream.get_final_message()
        except TimeoutError:
            logger.error("[stream_chat] Anthropic stream timed out after %ds for session %s", _STREAM_TIMEOUT, session_id)
            yield {"type": "error", "message": "Response timed out. Please try again."}
            return
        except anthropic.APIConnectionError as exc:
            logger.error("[stream_chat] Connection error for session %s: %s", session_id, exc)
            yield {"type": "error", "message": "Connection to AI service was interrupted. Please try again."}
            return
        except anthropic.RateLimitError as exc:
            logger.error("[stream_chat] Rate limit hit for session %s: %s", session_id, exc)
            yield {"type": "error", "message": "Too many requests. Please wait a moment and try again."}
            return
        except anthropic.APIStatusError as exc:
            logger.error("[stream_chat] Anthropic API error %d for session %s: %s", exc.status_code, session_id, exc)
            yield {"type": "error", "message": "AI service returned an error. Please try again."}
            return

        # Log token usage for cost tracking
        _log_usage(session_id, _round, final_message)

        # Record the assistant's full response in history (serialised to plain dicts
        # so the history is JSON-storable in Supabase)
        history.append({
            "role": "assistant",
            "content": _serialize_content(final_message.content),
        })

        # Check if the model wants to use tools
        tool_use_blocks = [
            block for block in final_message.content
            if block.type == "tool_use"
        ]

        if final_message.stop_reason != "tool_use" or not tool_use_blocks:
            # No tool use — we're done
            yield {"type": "done"}
            return

        # Execute all tool calls and build tool results
        tool_results = []
        for tool_block in tool_use_blocks:
            tool_id = f"tool_{tool_block.id}"

            # ── emit_ui is special — it emits a component event, not a tool indicator ──
            if tool_block.name == "emit_ui":
                component = tool_block.input.get("component", "")
                props = tool_block.input.get("props", {})

                # Validate before emitting
                error = validate_emit_ui(component, props)
                if not error:
                    yield {
                        "type": "component",
                        "name": component,
                        "props": props,
                        "id": f"comp_{tool_block.id}",
                    }

                result_str = await _safe_execute_tool(
                    session_id, tool_block.name, tool_block.input,
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": result_str,
                })
                continue

            # ── Normal tools: emit tool_start → execute → emit tool_complete ──

            description = _TOOL_DESCRIPTIONS.get(tool_block.name) or f"Running {tool_block.name}..."

            logger.info(
                "[stream_chat] executing tool %s for session %s",
                tool_block.name, session_id,
            )

            yield {
                "type": "tool_start",
                "tool": tool_block.name,
                "description": description,
                "id": tool_id,
            }

            result_str = await _safe_execute_tool(
                session_id, tool_block.name, tool_block.input,
            )

            try:
                result_data = json.loads(result_str)
            except (json.JSONDecodeError, TypeError):
                result_data = {}

            yield {
                "type": "tool_complete",
                "tool": tool_block.name,
                "id": tool_id,
                "result": result_data,
            }

            # ── Auto-emit state snapshots after state-changing tools ──

            # Emit state_snapshot after any state-changing tool.
            _snapshot_triggers = {"update_state": "saved", "advance_stage": "advanced"}
            if tool_block.name in _snapshot_triggers and result_data.get(_snapshot_triggers[tool_block.name]):
                yield {
                    "type": "state_snapshot",
                    "state": result_data.get("state", {}),
                    "stage": result_data.get("stage", ""),
                    "stateVersion": result_data.get("state_version", 0),
                }
                if tool_block.name == "advance_stage":
                    yield build_transition_event(result_data.get("stage", ""), tool_block.id)

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        # Add tool results to history and loop back for next response
        history.append({"role": "user", "content": tool_results})

    # Safety: if we hit the max rounds, end gracefully
    logger.warning("[stream_chat] hit MAX_TOOL_ROUNDS for session %s", session_id)
    yield {"type": "done"}


# ---------------------------------------------------------------------------
# Redesigned backend path (USE_NEW_EXPERIENCE)
# ---------------------------------------------------------------------------

_TOOL_DESCRIPTIONS_V2 = {
    "get_model": "Reading your property...",
    "apply_commands": "Saving your changes...",
    "emit_ui": None,  # handled specially — no tool indicator shown
}


def _phase_verb(commands: list) -> str:
    """A domain-grounded status verb for the thinking composer, derived from the
    command ops so the bar narrates the *real* pipeline (not a generic 'saving')."""
    # Recognises BOTH command vocabularies (legacy Property + recursive Space tree) so the
    # bar narrates on either path. Publish is checked first so a publish batch never falls
    # through to a structural verb.
    ops = {c.get("op") for c in commands if isinstance(c, dict)}
    if "Publish" in ops:
        return "Publishing your listing..."
    if ops & {"MapRooms", "UnmapRooms", "MapOffering", "UnmapOffering"}:
        return "Mapping the rooms..."
    if ops & {"CreatePackage", "UpdatePackage", "DisablePackage", "DeletePackage",
              "CreateOffering", "UpdateOffering", "DisableOffering", "DeleteOffering"}:
        return "Setting up packages..."
    if ops & {"AddFloors", "RenameFloor", "RemoveFloor", "SetFloorRooms", "SetRoomType",
              "SetNamingPattern", "RenameRoom", "AddSpaces", "RenameSpace", "RemoveSpace",
              "MoveSpace", "SetSharing", "SetConfig", "SetCapacity"}:
        return "Structuring the floors..."
    if ops & {"MarkUnavailable", "MarkRentable", "SetProperty"}:
        return "Updating the rooms..."
    return "Saving your changes..."

# Lazy singletons — survive across turns so the in-memory repos retain state.
_command_service: CommandService | None = None
_tree_command_service: TreeCommandService | None = None


def _select_tools(tools: list[dict]) -> list[dict]:
    """Drop emit_ui when UI components are disabled, so the model can only reply in
    text. Pure (never mutates the input) + env-driven so it can flip per request."""
    if ui_components_enabled():
        return list(tools)
    return [t for t in tools if t.get("name") != "emit_ui"]


_CHAT_ONLY_NOTE = (
    "\n\n[UI components are disabled for this session.] Respond in plain "
    "conversational text only — do not offer, describe, or imply interactive "
    "cards, selectors, or visual components."
)


def _chat_only_suffix() -> str:
    """A system-prompt suffix (only when UI is disabled) so the model knows to
    stay text-only and won't narrate components it cannot render."""
    return "" if ui_components_enabled() else _CHAT_ONLY_NOTE


def opening_prompt() -> str:
    """The silent opening message that triggers the greeting, matched to the active experience.

    The legacy prompt tells the model to call get_state; the v2 prompt tells it to call
    get_model — sending the wrong one makes the model reach for a tool that isn't wired in.
    """
    return INITIAL_PROMPT_V2 if use_new_experience() else INITIAL_PROMPT


def _get_command_service():
    """Build (once) the active command service for the new path.

    USE_TREE_MODEL on → the recursive-tree service (in-memory repo; tree persistence in
    Supabase lands with migration 0003). Else the flat Property CommandService, using the
    Supabase repo when the DB is live or the in-memory repo otherwise. Singleton so the
    in-memory store persists across turns within a process.
    """
    global _command_service, _tree_command_service
    if use_tree_model():
        if _tree_command_service is None:
            if db.use_memory_db():
                tree_repo = InMemoryTreeRepository()
            else:
                tree_repo = SupabaseTreeRepository(db._get_client())
            _tree_command_service = TreeCommandService(tree_repo)
        return _tree_command_service
    if _command_service is None:
        if db.use_memory_db():
            repo = InMemoryPropertyRepository()
        else:
            repo = SupabasePropertyRepository(db._get_client())
        _command_service = CommandService(repo)
    return _command_service


def _snapshot_event(result_data: dict) -> dict | None:
    """Map a tool result that carries a model (get_model / successful apply_commands) into a
    state_snapshot SSE event. Returns None for error results (no model)."""
    if not isinstance(result_data, dict) or "model" not in result_data:
        return None
    project = tree_adapter.tree_session_snapshot if use_tree_model() else to_legacy_session_snapshot
    return {"type": "state_snapshot", **project(result_data)}


async def _stream_chat_v2(
    session_id: str,
    user_message: str,
    history: list[dict],
) -> AsyncIterator[dict]:
    """Redesigned tool loop: get_model / apply_commands over CommandService, thin cached prompt
    + live context, legacy-shaped state_snapshot events. Mirrors the legacy streaming skeleton so
    the SSE contract (text / tool_start / tool_complete / component / state_snapshot / done) is
    preserved for the existing frontend."""
    client = _get_anthropic_client()
    svc = _get_command_service()
    core_prompt = load_system_prompt_v2()

    history.append({"role": "user", "content": user_message})

    # Live context (small, uncached) reflects state at the start of the turn; within the turn
    # the model gets fresh state from the apply_commands/get_model tool results it just received.
    try:
        snapshot = await svc.get_model(session_id)
        live_block = (tree_adapter.tree_live_context(snapshot) if use_tree_model()
                      else render_live_context(snapshot))
    except Exception:
        logger.exception("[stream_chat_v2] failed to render live context for %s", session_id)
        live_block = "## Current model (live)\n(Call get_model for the current state.)"

    for _round in range(MAX_TOOL_ROUNDS):
        api_history = _trim_history_for_api(history)
        logger.info(
            "[stream_chat_v2] round %d for session %s (%d messages, %d sent to API)",
            _round, session_id, len(history), len(api_history),
        )

        try:
            async with asyncio.timeout(_STREAM_TIMEOUT):
                async with client.messages.stream(
                    model=MODEL,
                    max_tokens=4096,
                    system=[
                        {
                            "type": "text",
                            "text": core_prompt + _chat_only_suffix(),
                            "cache_control": {"type": "ephemeral"},
                        },
                        {"type": "text", "text": live_block},
                    ],
                    messages=api_history,
                    tools=_select_tools(TOOL_DEFINITIONS_V2_TREE if use_tree_model()
                                        else TOOL_DEFINITIONS_V2),
                ) as stream:
                    async for event in stream:
                        if event.type == "content_block_delta":
                            if event.delta.type == "text_delta":
                                yield {"type": "text", "text": event.delta.text}
                    final_message = await stream.get_final_message()
        except TimeoutError:
            logger.error("[stream_chat_v2] stream timed out after %ds for session %s", _STREAM_TIMEOUT, session_id)
            yield {"type": "error", "message": "Response timed out. Please try again."}
            return
        except anthropic.APIConnectionError as exc:
            logger.error("[stream_chat_v2] Connection error for session %s: %s", session_id, exc)
            yield {"type": "error", "message": "Connection to AI service was interrupted. Please try again."}
            return
        except anthropic.RateLimitError as exc:
            logger.error("[stream_chat_v2] Rate limit hit for session %s: %s", session_id, exc)
            yield {"type": "error", "message": "Too many requests. Please wait a moment and try again."}
            return
        except anthropic.APIStatusError as exc:
            logger.error("[stream_chat_v2] API error %d for session %s: %s", exc.status_code, session_id, exc)
            yield {"type": "error", "message": "AI service returned an error. Please try again."}
            return

        _log_usage(session_id, _round, final_message)

        history.append({
            "role": "assistant",
            "content": _serialize_content(final_message.content),
        })

        tool_use_blocks = [b for b in final_message.content if b.type == "tool_use"]
        if final_message.stop_reason != "tool_use" or not tool_use_blocks:
            yield {"type": "done"}
            return

        tool_results = []
        for tool_block in tool_use_blocks:
            tool_id = f"tool_{tool_block.id}"

            # ── emit_ui: emit a component event, not a tool indicator ──
            if tool_block.name == "emit_ui":
                component = tool_block.input.get("component", "")
                props = tool_block.input.get("props", {})
                error = validate_emit_ui(component, props)
                if not error:
                    # Blueprint components are projected from the model (the source of
                    # truth) — never trust Claude-authored props for them.
                    if is_blueprint_component(component):
                        try:
                            model = (await svc.get_model(session_id)).get("model", {})
                            project = (tree_adapter.tree_blueprint_props if use_tree_model()
                                       else blueprint_props)
                            props = project(component, model) or props
                        except Exception:
                            logger.exception(
                                "[stream_chat_v2] blueprint projection failed for %s (session %s)",
                                component, session_id,
                            )
                    yield {
                        "type": "component",
                        "name": component,
                        "props": props,
                        "id": f"comp_{tool_block.id}",
                    }
                result_str = await _safe_execute_agent_tool(svc, session_id, tool_block.name, tool_block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": result_str,
                })
                continue

            # ── get_model / apply_commands: tool_start → execute → tool_complete ──
            description = _TOOL_DESCRIPTIONS_V2.get(tool_block.name) or f"Running {tool_block.name}..."
            if tool_block.name == "apply_commands":
                description = _phase_verb(tool_block.input.get("commands") or [])
            logger.info("[stream_chat_v2] executing tool %s for session %s", tool_block.name, session_id)
            yield {
                "type": "tool_start",
                "tool": tool_block.name,
                "description": description,
                "id": tool_id,
            }

            result_str = await _safe_execute_agent_tool(svc, session_id, tool_block.name, tool_block.input)
            try:
                result_data = json.loads(result_str)
            except (json.JSONDecodeError, TypeError):
                result_data = {}

            yield {
                "type": "tool_complete",
                "tool": tool_block.name,
                "id": tool_id,
                "result": result_data,
            }

            # Emit a state_snapshot whenever the result carries a model (get_model or a
            # successful apply_commands). Error results carry no model → no snapshot.
            snapshot_event = _snapshot_event(result_data)
            if snapshot_event is not None:
                yield snapshot_event

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        history.append({"role": "user", "content": tool_results})

    logger.warning("[stream_chat_v2] hit MAX_TOOL_ROUNDS for session %s", session_id)
    yield {"type": "done"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _safe_execute_agent_tool(
    svc: CommandService, session_id: str, tool_name: str, tool_input: dict,
) -> str:
    """Execute a redesigned-path tool with error handling — never raises, always returns JSON."""
    try:
        return await execute_agent_tool(svc, session_id, tool_name, tool_input)
    except Exception:
        logger.exception("[_safe_execute_agent_tool] %s failed for session %s", tool_name, session_id)
        return json.dumps({"error": f"Tool '{tool_name}' failed. Please try again.", "code": "TOOL_ERROR"})

async def _safe_execute_tool(
    session_id: str, tool_name: str, tool_input: dict,
) -> str:
    """Execute a tool with error handling — never raises, always returns JSON."""
    try:
        return await execute_tool(session_id, tool_name, tool_input)
    except Exception:
        logger.exception(
            "[_safe_execute_tool] %s failed for session %s",
            tool_name, session_id,
        )
        return json.dumps({
            "error": f"Tool '{tool_name}' failed. Please try again.",
        })


def _log_usage(session_id: str, round_num: int, message) -> None:
    """Log token usage from the API response for cost tracking."""
    try:
        usage = message.usage
        cache_read = getattr(usage, "cache_read_input_tokens", 0)
        cache_write = getattr(usage, "cache_creation_input_tokens", 0)
        logger.info(
            "[agent] tokens session=%s round=%d | "
            "input=%d cache_read=%d cache_write=%d output=%d",
            session_id, round_num,
            usage.input_tokens,
            cache_read,
            cache_write,
            usage.output_tokens,
        )
    except Exception:
        logger.debug("[stream_chat] could not read usage for session %s", session_id)


def _serialize_content(content) -> list[dict]:
    """Convert Anthropic SDK content blocks to plain JSON-serialisable dicts."""
    out: list[dict] = []
    for block in content:
        if block.type == "text":
            out.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            out.append({
                "type": "tool_use",
                "id": block.id,
                "name": block.name,
                "input": block.input,
            })
    return out
