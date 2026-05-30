"""Agent tool layer tests — get_model / apply_commands dispatch, happy paths, and the
error-translation contract (every failure becomes a structured, recoverable tool result).

Driven through a real CommandService over InMemory, so these assert the actual end-to-end
behaviour Claude will see, not mocks.
"""
from __future__ import annotations

import json

import pytest

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.tools.agent_tools import (
    TOOL_DEFINITIONS_V2,
    apply_commands_tool,
    execute_agent_tool,
    get_model_tool,
)

SID = "tool-sess"


def svc() -> CommandService:
    return CommandService(InMemoryPropertyRepository())


async def _apply(s, *commands, **kw):
    return json.loads(await apply_commands_tool(s, SID, {"commands": list(commands), **kw}))


# --------------------------------------------------------------------------- definitions
def test_tool_definitions_shape():
    names = {t["name"] for t in TOOL_DEFINITIONS_V2}
    assert names == {"get_model", "apply_commands"}
    apply_def = next(t for t in TOOL_DEFINITIONS_V2 if t["name"] == "apply_commands")
    # the command vocabulary is embedded in the description (the contract A4 teaches)
    assert "CreatePackage" in apply_def["description"]
    enum = apply_def["input_schema"]["properties"]["commands"]["items"]["properties"]["op"]["enum"]
    assert "MapRooms" in enum and "Publish" in enum


# --------------------------------------------------------------------------- get_model
async def test_get_model_empty():
    snap = json.loads(await get_model_tool(svc(), SID))
    assert snap["version"] == 0
    assert snap["completeness"]["publishable"] is False


# --------------------------------------------------------------------------- apply happy path
async def test_apply_commands_happy_path_returns_snapshot():
    s = svc()
    out = await _apply(s,
        {"op": "SetProperty", "name": "Sunrise", "type": "pg", "location": "HSR"},
        {"op": "AddFloors", "count": 2, "start_index": 1},
    )
    assert out["ok"] is True
    assert out["version"] == 1
    assert out["completeness"]["facets"]["property"] == "complete"
    assert [f["label"] for f in out["model"]["floors"]] == ["Floor 1", "Floor 2"]


async def test_warnings_surface_in_result():
    s = svc()
    out = await _apply(s, {"op": "CreatePackage", "name": "AC Double"})  # no rent
    assert out["ok"] is True
    assert any("rent" in w.lower() for w in out["warnings"])


# --------------------------------------------------------------------------- error translation
async def test_bad_command_returns_structured_error_nothing_applied():
    s = svc()
    out = await _apply(s, {"op": "Nonsense"})
    assert out["code"] == "BAD_COMMAND"
    # nothing was applied
    assert json.loads(await get_model_tool(s, SID))["version"] == 0


async def test_batch_atomic_abort_on_invariant():
    s = svc()
    await _apply(s, {"op": "CreatePackage", "name": "Std", "rent": 8000})  # v1
    out = await _apply(s,
        {"op": "AddFloors", "count": 1},
        {"op": "CreatePackage", "name": "std"},  # duplicate (case-insensitive) → INVARIANT
    )
    assert out["code"] == "INVARIANT"
    after = json.loads(await get_model_tool(s, SID))
    assert after["version"] == 1                       # not bumped
    assert len(after["model"]["floors"]) == 0          # AddFloors rolled back


async def test_not_found_translated():
    s = svc()
    out = await _apply(s, {"op": "RenameRoom", "room_id": "rm_ghost", "name": "X"})
    assert out["code"] == "NOT_FOUND"


async def test_publish_blocked_carries_open_items():
    s = svc()
    await _apply(s, {"op": "SetProperty", "name": "Half", "type": "pg", "location": "BTM"})
    out = await _apply(s, {"op": "Publish"})
    assert out["code"] == "PUBLISH_BLOCKED"
    assert isinstance(out["open_items"], list) and out["open_items"]


async def test_conflict_translated():
    s = svc()
    await _apply(s, {"op": "SetProperty", "name": "X"})  # version → 1
    out = await _apply(s, {"op": "SetProperty", "name": "Y"}, expected_version=0)  # stale
    assert out["code"] == "CONFLICT"


async def test_idempotency_key_dedupes():
    s = svc()
    a = await _apply(s, {"op": "AddFloors", "count": 1}, idempotency_key="k1")
    b = await _apply(s, {"op": "AddFloors", "count": 1}, idempotency_key="k1")
    assert a == b
    assert json.loads(await get_model_tool(s, SID))["version"] == 1  # applied once


# --------------------------------------------------------------------------- dispatcher
async def test_execute_agent_tool_routes_all_tools():
    s = svc()
    assert json.loads(await execute_agent_tool(s, SID, "get_model", {}))["version"] == 0

    ok = json.loads(await execute_agent_tool(
        s, SID, "apply_commands", {"commands": [{"op": "SetProperty", "name": "Z"}]}))
    assert ok["ok"] is True

    ui = json.loads(await execute_agent_tool(
        s, SID, "emit_ui", {"component": "WelcomeHero", "props": {}}))
    assert ui["rendered"] is True

    bad_ui = json.loads(await execute_agent_tool(
        s, SID, "emit_ui", {"component": "DoesNotExist", "props": {}}))
    assert bad_ui["code"] == "BAD_UI"

    unknown = json.loads(await execute_agent_tool(s, SID, "frobnicate", {}))
    assert unknown["code"] == "UNKNOWN_TOOL"
