"""
Tarini tool definitions for Anthropic API tool use.

TOOL_DEFINITIONS: list of dicts in Anthropic tool-use format.
execute_tool(session_id, tool_name, tool_input): dispatches to the right handler.
"""
from .state import get_state, update_state, advance_stage

TOOL_DEFINITIONS = [
    {
        "name": "get_state",
        "description": (
            "Get the current property onboarding state for this session. "
            "Call this at the start of every conversation — before saying anything — "
            "to know the stage and all property data collected so far. "
            "Never assume what is saved; always check."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "update_state",
        "description": (
            "Save confirmed property information. Call this after the user explicitly "
            "confirms a piece of information. The `updates` dict is deep-merged into the "
            "existing state — only pass the fields that actually changed. "
            "Never claim to have saved something without calling this tool first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "object",
                    "additionalProperties": True,
                    "description": (
                        "Key-value pairs to deep-merge into current state. "
                        "Use nested dicts for structured data."
                    ),
                }
            },
            "required": ["updates"],
        },
    },
    {
        "name": "advance_stage",
        "description": (
            "Mark the current onboarding stage as complete and record the next stage. "
            "Only call this when the user has confirmed all information for the current stage. "
            "Valid stages in order: intro → structure → packages → mapping → verification."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "enum": ["intro", "structure", "packages", "mapping", "verification"],
                    "description": "The stage to advance to.",
                }
            },
            "required": ["stage"],
        },
    },
]


async def execute_tool(session_id: str, tool_name: str, tool_input: dict) -> str:
    """Dispatch a tool call and return the result as a JSON string."""
    if tool_name == "get_state":
        return await get_state(session_id)
    elif tool_name == "update_state":
        return await update_state(session_id, tool_input.get("updates", {}))
    elif tool_name == "advance_stage":
        return await advance_stage(session_id, tool_input.get("stage", ""))
    else:
        return f'{{"error": "Unknown tool: {tool_name}"}}'
