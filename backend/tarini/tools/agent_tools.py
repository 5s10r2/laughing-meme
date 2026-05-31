"""Agent tool layer for the redesigned backend — Claude's interface to the Property model.

Two tools replace the old get_state/update_state/advance_stage trio:
  • get_model      — read the current model + completeness + open_items (what to do next)
  • apply_commands — mutate the model with a batch of typed commands, atomically

emit_ui is reused unchanged from tools.ui. Stage logic is gone — completeness is derived.

Every failure (malformed command, broken invariant, missing entity, stale version, publish
blocked) is translated into a structured tool result with a `code`, never an exception that
crashes the turn. That is the defense-in-depth contract: the model cannot corrupt data, and a
bad call returns something the model can read and recover from.

The dispatcher takes an injected CommandService, so the tool layer holds no global state and
A5 can wire the real (Supabase-backed) service in at the composition root.
"""
from __future__ import annotations

import json

from tarini.application.command_codec import (
    CommandDecodeError,
    command_catalog_text,
    decode_commands,
)
from tarini.application.command_service import CommandService
from tarini.application.errors import Conflict
from tarini.domain.commands import Command, Publish
from tarini.domain.errors import InvariantViolation, NotFound, PublishBlocked
from tarini.observability import emit_event
from tarini.tools.ui import validate_emit_ui, emit_ui_result

# Command names, for the apply_commands schema enum (auto-synced with the domain).
from tarini.application.command_codec import COMMAND_TYPES

# Blueprint component names, for the emit_ui schema enum (auto-synced with the registry).
from tarini.blueprint import BLUEPRINT_COMPONENTS

_COMMAND_NAMES = sorted(COMMAND_TYPES)
_BLUEPRINT_NAMES = sorted(BLUEPRINT_COMPONENTS)
# Components the v2 path may emit: the model-projected blueprint set (empty props,
# backend fills) + QuickReplyChips (Claude authors its `options`).
_EMIT_COMPONENTS = _BLUEPRINT_NAMES + ["QuickReplyChips"]


def _err(code: str, message: str, **extra) -> str:
    return json.dumps({"error": message, "code": code, **extra}, ensure_ascii=False)


TOOL_DEFINITIONS_V2 = [
    {
        "name": "get_model",
        "description": (
            "Read the current property model for this session: the data captured so far, plus "
            "`completeness` (which facets are empty/partial/complete), `open_items` (what still "
            "blocks publishing), and `version`. Call this at the start of every turn — before "
            "saying anything — and again after any apply_commands to see the updated state and "
            "the ids you need to reference. The model IS the memory; never assume what is saved."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "apply_commands",
        "description": (
            "Mutate the property model with a batch of typed commands. The batch is atomic — if "
            "any command is rejected, none are applied and nothing is saved. Prefer commands over "
            "prose: this is the only way to change saved data.\n\n"
            "Each command is an object with an `op` (the command name) plus its fields. Vocabulary "
            "(`?` = optional):\n" + command_catalog_text() + "\n\n"
            'Example: {"op": "CreatePackage", "name": "AC Double", "sharing": "double", '
            '"rent": 9000}\n\n'
            "Reference floors/rooms/packages by the ids returned from get_model. On success you "
            "get back the updated model, completeness, and any non-fatal warnings."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "description": "Ordered batch of commands to apply atomically.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": _COMMAND_NAMES,
                                "description": "The command name (e.g. CreatePackage).",
                            },
                        },
                        "required": ["op"],
                    },
                    "minItems": 1,
                },
                "expected_version": {
                    "type": "integer",
                    "description": (
                        "Optional optimistic-concurrency guard: the version you last read from "
                        "get_model. If the session moved on since then, the call is rejected with "
                        "a CONFLICT and you should re-read with get_model."
                    ),
                },
                "idempotency_key": {
                    "type": "string",
                    "description": "Optional key so a retried identical batch is applied only once.",
                },
            },
            "required": ["commands"],
        },
    },
    {
        "name": "emit_ui",
        "description": (
            "Render a component in the chat. Call get_model first so the saved data is "
            "current; you may emit more than one component in a turn.\n\n"
            "BLUEPRINT components are projected from the saved model — pass an empty props "
            "object ({}); the backend fills them, so what you show always matches what's "
            "saved:\n"
            "- MassingModel — the signature isometric building. Show it after floors are "
            "added or changed, so the user sees their property take shape.\n"
            "- FloorLedger — a top-down list of every floor with its room mix. Show it when "
            "reviewing or editing structure room-by-room.\n"
            "- BlueprintMapping — per-floor room→package assignment. Show it during the "
            "mapping step.\n"
            "- UnmappedWarning — floors with rooms not yet on a package. Show it when rooms "
            "remain unmapped before publishing.\n\n"
            "QuickReplyChips is the exception — YOU author its options. Use it for "
            "low-friction tap-able choices (gender, yes/no, accept a suggestion). Pass "
            'props {"options": [{"label": "Men", "value": "Men"}, ...]} (2–5 short choices). '
            "Always ask the question in words too."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "component": {
                    "type": "string",
                    "enum": _EMIT_COMPONENTS,
                    "description": "Which component to render.",
                },
                "props": {
                    "type": "object",
                    "additionalProperties": True,
                    "description": (
                        "Blueprint components: leave empty ({}) — the backend fills props "
                        'from the model. QuickReplyChips: pass {"options": [{"label","value"}]}.'
                    ),
                },
            },
            "required": ["component"],
        },
    },
]


async def get_model_tool(svc: CommandService, session_id: str) -> str:
    snapshot = await svc.get_model(session_id)
    return json.dumps(snapshot, ensure_ascii=False)


def _reject(session_id: str, code: str, message: str, ops: list[str] | None = None, **extra) -> str:
    emit_event("command_rejected", session=session_id, code=code, **({"ops": ops} if ops else {}))
    return _err(code, message, **extra)


async def apply_commands_tool(svc: CommandService, session_id: str, tool_input: dict) -> str:
    # 1) decode at the boundary — fail fast, nothing applied
    try:
        commands: list[Command] = decode_commands(tool_input.get("commands"))
    except CommandDecodeError as e:
        return _reject(session_id, "BAD_COMMAND", str(e))

    ops = [type(c).__name__ for c in commands]

    # 2) apply atomically, translating every domain/application error into a clean result
    try:
        snapshot = await svc.apply(
            session_id,
            commands,
            expected_version=tool_input.get("expected_version"),
            idempotency_key=tool_input.get("idempotency_key"),
        )
    except PublishBlocked as e:
        return _reject(session_id, "PUBLISH_BLOCKED", str(e), ops=ops, open_items=e.open_items)
    except NotFound as e:
        return _reject(session_id, "NOT_FOUND", str(e), ops=ops)
    except InvariantViolation as e:
        return _reject(session_id, "INVARIANT", str(e), ops=ops)
    except Conflict as e:
        return _reject(session_id, "CONFLICT", str(e), ops=ops)

    completeness = snapshot.get("completeness", {})
    emit_event(
        "commands_applied", session=session_id, ops=ops,
        version=snapshot.get("version"), publishable=completeness.get("publishable", False),
    )
    if any(isinstance(c, Publish) for c in commands):
        emit_event("published", session=session_id, counts=completeness.get("counts", {}))

    return json.dumps({"ok": True, **snapshot}, ensure_ascii=False)


async def execute_agent_tool(
    svc: CommandService, session_id: str, tool_name: str, tool_input: dict
) -> str:
    """Dispatch a redesigned-backend tool call. emit_ui validation is reused as-is."""
    if tool_name == "get_model":
        return await get_model_tool(svc, session_id)
    if tool_name == "apply_commands":
        return await apply_commands_tool(svc, session_id, tool_input)
    if tool_name == "emit_ui":
        component = tool_input.get("component", "")
        props = tool_input.get("props", {})
        error = validate_emit_ui(component, props)
        if error:
            return _err("BAD_UI", error)
        return emit_ui_result(component)
    return _err("UNKNOWN_TOOL", f"Unknown tool: {tool_name}")
