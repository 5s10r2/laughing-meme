"""
Tarini's 3 MCP tools — each bound to a specific session_id via closure.

Tool pattern: build_state_tools(session_id) returns a list of SdkMcpTool instances
that are wired to the correct session without needing session_id as a call argument.
"""
import json
from copy import deepcopy
from typing import Any

from claude_agent_sdk import tool

from tarini.db import client as db


# ---------------------------------------------------------------------------
# Deep merge utility
# ---------------------------------------------------------------------------

def _deep_merge(base: dict, updates: dict) -> dict:
    """
    Recursively merge `updates` into `base`.
    - Dicts are merged recursively.
    - All other types are overwritten.
    - Lists are overwritten (not appended), allowing replacements.
    """
    result = deepcopy(base)
    for key, value in updates.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# ---------------------------------------------------------------------------
# Tool factory
# ---------------------------------------------------------------------------

VALID_STAGES = ("intro", "structure", "packages", "mapping", "verification")


def build_state_tools(session_id: str) -> list:
    """
    Create tool instances bound to the given session_id.
    Called once per ClaudeSDKClient instantiation.
    """

    @tool(
        "get_state",
        (
            "Get the current property onboarding state for this session. "
            "Call this at the start of every conversation — before saying anything — "
            "to know the stage and all property data collected so far. "
            "Never assume what is saved; always check."
        ),
        {},
    )
    async def get_state(args: dict[str, Any]) -> dict[str, Any]:
        session = await db.get_session(session_id)
        if not session:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "Session not found"})}],
                "is_error": True,
            }
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "stage": session.get("stage", "intro"),
                            "state": session.get("state") or {},
                            "state_version": session.get("state_version", 1),
                        },
                        ensure_ascii=False,
                    ),
                }
            ]
        }

    @tool(
        "update_state",
        (
            "Save confirmed property information. Call this after the user explicitly "
            "confirms a piece of information. The `updates` dict is deep-merged into the "
            "existing state — only pass the fields that actually changed. "
            "Never claim to have saved something without calling this tool first."
        ),
        {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "object",
                    "additionalProperties": True,
                    "description": (
                        "Key-value pairs to deep-merge into current state. "
                        "Use nested dicts for structured data. "
                        "Example: {\"floors\": [{\"index\": 0, \"label\": \"Ground Floor\"}], "
                        "\"packages\": [{\"id\": \"pkg_001\", \"name\": \"AC Double\", \"active\": true}]}"
                    ),
                }
            },
            "required": ["updates"],
        },
    )
    async def update_state(args: dict[str, Any]) -> dict[str, Any]:
        updates = args.get("updates", {})
        if not updates:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "No updates provided"})}],
                "is_error": True,
            }

        session = await db.get_session(session_id)
        if not session:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "Session not found"})}],
                "is_error": True,
            }

        current_state = session.get("state") or {}
        new_state = _deep_merge(current_state, updates)
        updated = await db.update_session_state(session_id, new_state)

        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "saved": True,
                            "state_version": updated.get("state_version"),
                            "state": updated.get("state") or new_state,
                        },
                        ensure_ascii=False,
                    ),
                }
            ]
        }

    @tool(
        "advance_stage",
        (
            "Mark the current onboarding stage as complete and record the next stage. "
            "Only call this when the user has confirmed all information for the current stage. "
            "Valid stages in order: intro → structure → packages → mapping → verification."
        ),
        {"stage": str},
    )
    async def advance_stage(args: dict[str, Any]) -> dict[str, Any]:
        stage = args.get("stage", "").strip()
        if stage not in VALID_STAGES:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "error": (
                                    f"Invalid stage: '{stage}'. "
                                    f"Must be one of: {', '.join(VALID_STAGES)}"
                                )
                            }
                        ),
                    }
                ],
                "is_error": True,
            }

        updated = await db.advance_stage(session_id, stage)
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({"stage": updated.get("stage"), "advanced": True}),
                }
            ]
        }

    return [get_state, update_state, advance_stage]
