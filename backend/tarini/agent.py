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
from tarini.prompts import load_system_prompt
from tarini.stage_ui import build_transition_event
from tarini.tools import TOOL_DEFINITIONS, execute_tool
from tarini.tools.ui import validate_emit_ui

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

        # Stream the API response
        tool_use_blocks = []

        try:
            async with asyncio.timeout(_STREAM_TIMEOUT):
                async with client.messages.stream(
                    model=MODEL,
                    max_tokens=4096,
                    system=[{
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    messages=api_history,
                    tools=TOOL_DEFINITIONS,
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
# Helpers
# ---------------------------------------------------------------------------

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
            "[stream_chat] tokens session=%s round=%d | "
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
