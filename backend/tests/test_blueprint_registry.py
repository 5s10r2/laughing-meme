"""Blueprint component projection registry — name → model-backed props.

The backend owns the props for blueprint components (the model is the source of
truth); Claude only chooses WHICH component to emit. This registry maps a
component name to its tested ui_adapter projection, so emitting a blueprint
component never trusts Claude-authored arrays.
"""
from __future__ import annotations

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.domain import commands as c
from tarini.blueprint import (
    BLUEPRINT_COMPONENTS,
    blueprint_props,
    is_blueprint_component,
)
from tarini.ui_adapter import (
    massing_props,
    floor_ledger_props,
    mapping_props,
    unmapped_props,
    package_panel_props,
)


async def _model() -> dict:
    svc = CommandService(InMemoryPropertyRepository())
    await svc.apply("s", [c.SetProperty(name="Sunrise PG", type="pg", location="HSR")])
    r = await svc.apply("s", [c.AddFloors(count=2, start_index=1)])
    f1 = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f1, count=3, type_mix={"single": 2, "double": 1})])
    r = await svc.apply("s", [c.CreatePackage(name="AC Single", sharing="single", rent=9000)])
    pkg = r["model"]["packages"][0]["id"]
    f1_rooms = [room["id"] for room in r["model"]["rooms"] if room["floor_id"] == f1]
    r = await svc.apply("s", [c.MapRooms(room_ids=f1_rooms[:2], package_id=pkg)])
    return r["model"]


def test_blueprint_component_set_is_the_projected_components():
    assert BLUEPRINT_COMPONENTS == frozenset(
        {"MassingModel", "FloorLedger", "BlueprintMapping", "UnmappedWarning", "PackagePanel"}
    )


def test_is_blueprint_component_membership():
    assert is_blueprint_component("MassingModel") is True
    assert is_blueprint_component("BlueprintMapping") is True
    assert is_blueprint_component("PackageForm") is False   # legacy card, not blueprint
    assert is_blueprint_component("") is False


async def test_blueprint_props_dispatch_matches_projections():
    m = await _model()
    assert blueprint_props("MassingModel", m) == massing_props(m)
    assert blueprint_props("FloorLedger", m) == floor_ledger_props(m)
    assert blueprint_props("BlueprintMapping", m) == mapping_props(m)
    assert blueprint_props("UnmappedWarning", m) == unmapped_props(m)
    assert blueprint_props("PackagePanel", m) == package_panel_props(m)


async def test_blueprint_props_none_for_non_blueprint():
    m = await _model()
    assert blueprint_props("PackageForm", m) is None
    assert blueprint_props("WelcomeHero", m) is None


async def test_blueprint_props_emits_no_colour():
    """Backend stays colourless — the frontend maps category/package → palette.
    Asserted against a populated model so the segments/units are actually present."""
    m = await _model()
    for name in BLUEPRINT_COMPONENTS:
        props = blueprint_props(name, m)
        assert isinstance(props, dict)
        assert "color" not in str(props).lower()
