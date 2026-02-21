"""
Anthropic API agent — streams Claude responses with tool-use loop.

stream_chat(session_id, user_message, history) is the single entry point.
It yields SSE-ready dicts: {"type": "text", "text": "..."} and {"type": "done"}.
"""
import logging
import os
from typing import AsyncIterator

import anthropic

from tarini.prompts import load_system_prompt
from tarini.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOOL_ROUNDS = 10  # safety limit to prevent infinite tool loops


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
        SSE event dicts: {"type": "text", "text": "..."} or {"type": "done"}.
    """
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = load_system_prompt()

    # Add the user message to history
    history.append({"role": "user", "content": user_message})

    for _round in range(MAX_TOOL_ROUNDS):
        logger.info(
            "[stream_chat] round %d for session %s (%d messages)",
            _round, session_id, len(history),
        )

        # Stream the API response
        collected_text = ""
        tool_use_blocks = []

        async with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=history,
            tools=TOOL_DEFINITIONS,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        text = event.delta.text
                        collected_text += text
                        yield {"type": "text", "text": text}

            # Get the final message to check for tool use
            final_message = await stream.get_final_message()

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
            logger.info(
                "[stream_chat] executing tool %s for session %s",
                tool_block.name, session_id,
            )
            result_str = await execute_tool(
                session_id, tool_block.name, tool_block.input,
            )
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
