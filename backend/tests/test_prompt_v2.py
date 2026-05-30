"""Tests for the redesigned thin prompt + the per-turn live-context renderer."""
from __future__ import annotations

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.domain import commands as c
from tarini.prompts import (
    INITIAL_PROMPT_V2,
    load_system_prompt_v2,
    render_live_context,
)


# --------------------------------------------------------------------------- the prompt
def test_v2_prompt_loads_and_is_thin():
    p = load_system_prompt_v2()
    # generous ceiling — the design target is ~120-150 lines; guard against regrowth
    assert len(p.splitlines()) < 160
    assert "Tarini" in p


def test_v2_prompt_teaches_the_new_tools_not_the_old():
    p = load_system_prompt_v2()
    for tool in ("get_model", "apply_commands", "emit_ui"):
        assert tool in p
    # the retired surface must be gone — no stage gates, no old state tools
    for retired in ("get_state", "update_state", "advance_stage", "Stage 1", "Stage 2", "5 Stages"):
        assert retired not in p


def test_v2_prompt_does_not_duplicate_the_command_catalog():
    # vocabulary lives in the apply_commands tool description, not the prompt (no drift)
    p = load_system_prompt_v2()
    assert "CreatePackage(" not in p and "MapRooms(" not in p


def test_initial_prompt_v2_uses_get_model():
    assert "get_model" in INITIAL_PROMPT_V2
    assert "get_state" not in INITIAL_PROMPT_V2


# --------------------------------------------------------------------------- live context
async def _snapshot(*commands) -> dict:
    svc = CommandService(InMemoryPropertyRepository())
    if commands:
        return await svc.apply("s", list(commands))
    return await svc.get_model("s")


async def test_live_context_empty_session():
    block = render_live_context(await _snapshot())
    assert "new property — nothing captured yet" in block
    assert "0 floors" in block
    assert "Call get_model" in block


async def test_live_context_shows_identity_and_open_items():
    block = render_live_context(await _snapshot(
        c.SetProperty(name="Sunrise PG", type="pg", location="Koramangala"),
    ))
    assert "Sunrise PG" in block
    assert "pg" in block and "Koramangala" in block
    assert "Still open before publish:" in block
    assert "property ✓" in block  # facet glyph rendered


async def test_live_context_reports_ready_when_publishable():
    svc = CommandService(InMemoryPropertyRepository())
    await svc.apply("s", [c.SetProperty(name="X", type="pg", location="Y")])
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    fid = r["model"]["floors"][0]["id"]
    await svc.apply("s", [c.SetFloorRooms(floor_id=fid, count=1)])
    r = await svc.apply("s", [c.CreatePackage(name="Std", rent=8000)])
    pid = r["model"]["packages"][0]["id"]
    room_id = r["model"]["rooms"][0]["id"]
    snap = await svc.apply("s", [c.MapRooms(room_ids=[room_id], package_id=pid)])

    block = render_live_context(snap)
    assert "Ready to publish" in block
    assert "Still open" not in block
