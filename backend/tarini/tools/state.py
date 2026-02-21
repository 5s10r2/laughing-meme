"""
Tarini's 3 state tools — pure async functions returning JSON strings.

These are called by the tool dispatcher in __init__.py.
"""
import json
from copy import deepcopy

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


VALID_STAGES = ("intro", "structure", "packages", "mapping", "verification")


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def get_state(session_id: str) -> str:
    """Return session state as JSON string."""
    session = await db.get_session(session_id)
    if not session:
        return json.dumps({"error": "Session not found"})
    return json.dumps(
        {
            "stage": session.get("stage", "intro"),
            "state": session.get("state") or {},
            "state_version": session.get("state_version", 1),
        },
        ensure_ascii=False,
    )


async def update_state(session_id: str, updates: dict) -> str:
    """Deep-merge updates into session state. Return result as JSON string."""
    if not updates:
        return json.dumps({"error": "No updates provided"})

    session = await db.get_session(session_id)
    if not session:
        return json.dumps({"error": "Session not found"})

    current_state = session.get("state") or {}
    new_state = _deep_merge(current_state, updates)
    updated = await db.update_session_state(session_id, new_state)

    return json.dumps(
        {
            "saved": True,
            "state_version": updated.get("state_version"),
            "state": updated.get("state") or new_state,
        },
        ensure_ascii=False,
    )


async def advance_stage(session_id: str, stage: str) -> str:
    """Advance the session to a new stage. Return result as JSON string."""
    stage = (stage or "").strip()
    if stage not in VALID_STAGES:
        return json.dumps(
            {
                "error": (
                    f"Invalid stage: '{stage}'. "
                    f"Must be one of: {', '.join(VALID_STAGES)}"
                )
            }
        )

    updated = await db.advance_stage(session_id, stage)
    return json.dumps({"stage": updated.get("stage"), "advanced": True})
