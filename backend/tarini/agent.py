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
import json
import logging
import os
from typing import AsyncIterator

import anthropic

from tarini.prompts import load_system_prompt
from tarini.tools import TOOL_DEFINITIONS, execute_tool
from tarini.tools.ui import validate_emit_ui

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOOL_ROUNDS = 10  # safety limit to prevent infinite tool loops
_MAX_API_HISTORY = 20  # ~5 tool-use turns of context for the API call


# ---------------------------------------------------------------------------
# Sliding window — keeps API costs bounded
# ---------------------------------------------------------------------------

def _trim_history_for_api(history: list[dict]) -> list[dict]:
    """Return a trimmed copy of history for the API call.

    The full history stays intact in SessionManager for Supabase persistence.
    get_state provides all captured property data, so old conversation turns
    are redundant — the state IS the memory.
    """
    if len(history) <= _MAX_API_HISTORY:
        return history
    return history[-_MAX_API_HISTORY:]


# ---------------------------------------------------------------------------
# Tool description mapping for user-friendly tool_start messages
# ---------------------------------------------------------------------------

_TOOL_DESCRIPTIONS = {
    "get_state": "Checking your progress...",
    "update_state": "Saving your information...",
    "advance_stage": "Moving to the next stage...",
    "emit_ui": None,  # emit_ui is handled specially — no tool indicator shown
}


def _tool_description(tool_name: str, tool_input: dict) -> str:
    """Generate a user-friendly description for a tool execution."""
    desc = _TOOL_DESCRIPTIONS.get(tool_name)
    if desc:
        return desc

    # Fallback for unknown tools
    return f"Running {tool_name}..."


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
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
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
        collected_text = ""
        tool_use_blocks = []

        async with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=api_history,
            tools=TOOL_DEFINITIONS,
            cache_control={"type": "ephemeral"},
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        text = event.delta.text
                        collected_text += text
                        yield {"type": "text", "text": text}

            # Get the final message to check for tool use
            final_message = await stream.get_final_message()

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

                # Execute the tool (returns confirmation or error to Claude)
                result_str = await execute_tool(
                    session_id, tool_block.name, tool_block.input,
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": result_str,
                })
                continue

            # ── Normal tools: emit tool_start → execute → emit tool_complete ──

            description = _tool_description(tool_block.name, tool_block.input)

            logger.info(
                "[stream_chat] executing tool %s for session %s",
                tool_block.name, session_id,
            )

            # Emit tool_start
            yield {
                "type": "tool_start",
                "tool": tool_block.name,
                "description": description,
                "id": tool_id,
            }

            # Execute the tool
            result_str = await execute_tool(
                session_id, tool_block.name, tool_block.input,
            )

            # Parse result for structured events
            try:
                result_data = json.loads(result_str)
            except (json.JSONDecodeError, TypeError):
                result_data = {}

            # Emit tool_complete
            yield {
                "type": "tool_complete",
                "tool": tool_block.name,
                "id": tool_id,
                "result": result_data,
            }

            # ── Auto-emit events based on tool results ──

            # After update_state: emit state_snapshot so frontend stays in sync
            if tool_block.name == "update_state" and result_data.get("saved"):
                state = result_data.get("state", {})
                version = result_data.get("state_version", 0)
                # We need the current stage — get it from the session
                from tarini.db import client as db
                session = await db.get_session(session_id)
                stage = session.get("stage", "intro") if session else "intro"

                yield {
                    "type": "state_snapshot",
                    "state": state,
                    "stage": stage,
                    "stateVersion": version,
                }


            # After advance_stage: emit state_snapshot with new stage
            if tool_block.name == "advance_stage" and result_data.get("advanced"):
                new_stage = result_data.get("stage", "")
                # Get full state for the snapshot
                from tarini.db import client as db
                session = await db.get_session(session_id)
                state = session.get("state", {}) if session else {}
                version = session.get("state_version", 0) if session else 0

                yield {
                    "type": "state_snapshot",
                    "state": state,
                    "stage": new_stage,
                    "stateVersion": version,
                }

                # Determine stage descriptions for the transition card
                stage_labels = {
                    "intro": "Introduction",
                    "structure": "Property Structure",
                    "packages": "Rental Packages",
                    "mapping": "Room Mapping",
                    "verification": "Verification",
                }
                stage_descriptions = {
                    "structure": "Define your floors, rooms, and naming convention",
                    "packages": "Set up your rental packages with pricing",
                    "mapping": "Assign packages to your rooms",
                    "verification": "Review and confirm everything",
                }

                yield {
                    "type": "component",
                    "name": "StageTransitionCard",
                    "props": {
                        "completedStage": _get_previous_stage(new_stage),
                        "completedStageLabel": stage_labels.get(
                            _get_previous_stage(new_stage), ""
                        ),
                        "nextStage": new_stage,
                        "nextStageLabel": stage_labels.get(new_stage, ""),
                        "nextStageDescription": stage_descriptions.get(
                            new_stage, ""
                        ),
                    },
                    "id": f"transition_{tool_block.id}",
                }

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

def _get_previous_stage(current_stage: str) -> str:
    """Return the stage before the given stage."""
    stages = ["intro", "structure", "packages", "mapping", "verification"]
    idx = stages.index(current_stage) if current_stage in stages else 0
    return stages[max(0, idx - 1)]


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
