"""Observability tests — the funnel events emitted at the command-tool boundary.

These are the signals that make a live flag flip safe to watch: what commands land, how often
they're rejected (and why), and whether sessions reach publish. Structured log lines only —
greppable on Render, no new infra.
"""
from __future__ import annotations

import json
import logging

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.observability import emit_event
from tarini.tools.agent_tools import apply_commands_tool

SID = "obs-sess"


def _funnel_records(caplog) -> list[dict]:
    out = []
    for r in caplog.records:
        msg = r.getMessage()
        if msg.startswith("[funnel] "):
            out.append(json.loads(msg[len("[funnel] "):]))
    return out


def svc() -> CommandService:
    return CommandService(InMemoryPropertyRepository())


async def _apply(s, *commands, **kw):
    return await apply_commands_tool(s, SID, {"commands": list(commands), **kw})


# --------------------------------------------------------------------------- emit_event
def test_emit_event_returns_and_logs(caplog):
    with caplog.at_level(logging.INFO, logger="tarini.funnel"):
        result = emit_event("thing_happened", session="s", n=3)
    assert result == {"event": "thing_happened", "session": "s", "n": 3}
    recs = _funnel_records(caplog)
    assert recs and recs[-1]["event"] == "thing_happened" and recs[-1]["n"] == 3


# --------------------------------------------------------------------------- command funnel
async def test_commands_applied_event_records_ops_and_version(caplog):
    s = svc()
    with caplog.at_level(logging.INFO, logger="tarini.funnel"):
        await _apply(s,
            {"op": "SetProperty", "name": "Sunrise", "type": "pg", "location": "HSR"},
            {"op": "AddFloors", "count": 2},
        )
    rec = next(r for r in _funnel_records(caplog) if r["event"] == "commands_applied")
    assert rec["session"] == SID
    assert rec["ops"] == ["SetProperty", "AddFloors"]
    assert rec["version"] == 1
    assert rec["publishable"] is False


async def test_command_rejected_event_carries_code(caplog):
    s = svc()
    with caplog.at_level(logging.INFO, logger="tarini.funnel"):
        await _apply(s, {"op": "Bogus"})                       # decode failure
        await _apply(s, {"op": "RenameRoom", "room_id": "ghost", "name": "X"})  # NOT_FOUND
    recs = [r for r in _funnel_records(caplog) if r["event"] == "command_rejected"]
    codes = {r["code"] for r in recs}
    assert "BAD_COMMAND" in codes
    assert "NOT_FOUND" in codes


async def test_published_event_emitted_on_successful_publish(caplog):
    s = svc()
    # build a publishable property
    r = await _apply(s, {"op": "SetProperty", "name": "X", "type": "pg", "location": "Y"})
    r = await _apply(s, {"op": "AddFloors", "count": 1, "start_index": 1})
    import json as _json
    fid = _json.loads(r)["model"]["floors"][0]["id"]
    r = await _apply(s, {"op": "SetFloorRooms", "floor_id": fid, "count": 1})
    rid = _json.loads(r)["model"]["rooms"][0]["id"]
    r = await _apply(s, {"op": "CreatePackage", "name": "Std", "rent": 8000})
    pid = _json.loads(r)["model"]["packages"][0]["id"]
    await _apply(s, {"op": "MapRooms", "room_ids": [rid], "package_id": pid})

    with caplog.at_level(logging.INFO, logger="tarini.funnel"):
        await _apply(s, {"op": "Publish"})
    recs = [r for r in _funnel_records(caplog) if r["event"] == "published"]
    assert recs and recs[-1]["session"] == SID


async def test_publish_blocked_records_rejection_not_published(caplog):
    s = svc()
    await _apply(s, {"op": "SetProperty", "name": "Half", "type": "pg", "location": "Z"})
    with caplog.at_level(logging.INFO, logger="tarini.funnel"):
        await _apply(s, {"op": "Publish"})
    recs = _funnel_records(caplog)
    assert not any(r["event"] == "published" for r in recs)
    assert any(r["event"] == "command_rejected" and r["code"] == "PUBLISH_BLOCKED" for r in recs)
