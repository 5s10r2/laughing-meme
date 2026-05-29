"""
Stage transition UI metadata — keeps agent.py focused on the streaming loop.

The backend emits only the raw stage keys. The frontend StageTransitionCard
component owns the display labels and descriptions, so they are NOT duplicated
here. Stage order is derived from VALID_STAGES (the single source of truth).
"""
from __future__ import annotations

from tarini.tools.state import VALID_STAGES

STAGE_ORDER = list(VALID_STAGES)


def get_previous_stage(current_stage: str) -> str:
    """Return the stage before the given stage."""
    idx = STAGE_ORDER.index(current_stage) if current_stage in STAGE_ORDER else 0
    return STAGE_ORDER[max(0, idx - 1)]


def build_transition_event(new_stage: str, tool_block_id: str) -> dict:
    """Build a StageTransitionCard component event for SSE."""
    return {
        "type": "component",
        "name": "StageTransitionCard",
        "props": {
            "completedStage": get_previous_stage(new_stage),
            "nextStage": new_stage,
        },
        "id": f"transition_{tool_block_id}",
    }
