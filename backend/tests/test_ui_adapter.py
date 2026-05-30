"""UI adapter tests — projects a CommandService snapshot into the legacy frontend shape.

This is the back-compat bridge so the EXISTING frontend renders the redesigned backend
correctly while the flag is on (Phase B retargets the adapter to the Living Blueprint).

Driven through real CommandService snapshots — no mocks.
"""
from __future__ import annotations

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.domain import commands as c
from tarini.ui_adapter import (
    derive_stage,
    normalize_gender,
    to_legacy_session_snapshot,
)


async def _snap(*commands) -> dict:
    svc = CommandService(InMemoryPropertyRepository())
    if commands:
        return await svc.apply("s", list(commands))
    return await svc.get_model("s")


# --------------------------------------------------------------------------- gender
def test_normalize_gender():
    assert normalize_gender("male") == "male"
    assert normalize_gender("female") == "female"
    assert normalize_gender("co-ed") == "coed"
    assert normalize_gender("coed") == "coed"
    assert normalize_gender("boys") == "male"
    assert normalize_gender("girls") == "female"
    assert normalize_gender(None) is None
    assert normalize_gender("") is None


# --------------------------------------------------------------------------- derive_stage
def test_derive_stage_progression():
    assert derive_stage({"property": "empty"}) == "intro"
    assert derive_stage({"property": "complete", "structure": "partial"}) == "structure"
    assert derive_stage({"property": "complete", "structure": "complete",
                         "packages": "partial"}) == "packages"
    assert derive_stage({"property": "complete", "structure": "complete",
                         "packages": "complete", "mapping": "partial"}) == "mapping"
    assert derive_stage({"property": "complete", "structure": "complete",
                         "packages": "complete", "mapping": "complete"}) == "verification"


# --------------------------------------------------------------------------- empty
async def test_empty_snapshot_maps_to_intro_defaults():
    out = to_legacy_session_snapshot(await _snap())
    assert out["stage"] == "intro"
    assert out["stateVersion"] == 0
    assert out["state"]["floors"] == []
    assert out["state"]["units"] == []
    assert out["state"]["packages"] == []


# --------------------------------------------------------------------------- property fields
async def test_property_fields_renamed_to_legacy_keys():
    out = to_legacy_session_snapshot(await _snap(
        c.SetProperty(owner_name="Ramesh", name="Sunrise PG", type="pg",
                      location="Koramangala", gender="co-ed"),
    ))
    s = out["state"]
    assert s["user_name"] == "Ramesh"
    assert s["property_name"] == "Sunrise PG"
    assert s["property_type"] == "pg"
    assert s["property_location"] == "Koramangala"
    assert s["gender_preference"] == "coed"


# --------------------------------------------------------------------------- floors
async def test_floors_mapped_to_legacy_shape():
    snap = await _snap(c.AddFloors(count=2, start_index=1))
    out = to_legacy_session_snapshot(snap)
    floors = out["state"]["floors"]
    assert [f["label"] for f in floors] == ["Floor 1", "Floor 2"]
    assert all("index" in f and "active" in f for f in floors)
    assert all("id" not in f for f in floors)  # legacy Floor has no id


# --------------------------------------------------------------------------- rooms → units
async def test_rooms_mapped_to_units_with_floor_index_and_sharing():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=2)])  # index 2
    fid = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=fid, count=2)])
    rid0 = r["model"]["rooms"][0]["id"]
    r = await svc.apply("s", [c.SetRoomType(room_ids=[rid0], category="single", sharing="single")])

    out = to_legacy_session_snapshot(r)
    units = out["state"]["units"]
    assert len(units) == 2
    u0 = next(u for u in units if u["id"] == rid0)
    assert u0["floor_index"] == 2            # resolved from the room's floor
    assert u0["category"] == "single"
    assert u0["sharing_type"] == "single"    # room.sharing → unit.sharing_type
    assert u0["active"] is True              # status active → active True


async def test_unavailable_room_maps_to_inactive_unit():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    fid = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=fid, count=1)])
    rid = r["model"]["rooms"][0]["id"]
    r = await svc.apply("s", [c.MarkUnavailable(room_ids=[rid])])
    units = to_legacy_session_snapshot(r)["state"]["units"]
    assert units[0]["active"] is False


# --------------------------------------------------------------------------- packages
async def test_packages_mapped_with_rent_food_and_sharing():
    out = to_legacy_session_snapshot(await _snap(
        c.CreatePackage(name="AC Double", sharing="double", ac=True, food="included",
                        furnishing="furnished", rent=9000, amenities=["wifi"]),
    ))
    pkgs = out["state"]["packages"]
    assert len(pkgs) == 1
    p = pkgs[0]
    assert p["name"] == "AC Double"
    assert p["sharing_type"] == "double"        # sharing → sharing_type
    assert p["starting_rent"] == 9000           # rent → starting_rent
    assert p["food_included"] is True
    assert p["food_optional"] is False
    assert p["furnishing"] == "furnished"
    assert p["amenities"] == ["wifi"]
    assert p["active"] is True


async def test_food_optional_package():
    out = to_legacy_session_snapshot(await _snap(
        c.CreatePackage(name="Veg Optional", rent=7000, food="optional"),
    ))
    p = out["state"]["packages"][0]
    assert p["food_included"] is False
    assert p["food_optional"] is True


# --------------------------------------------------------------------------- version + stage
async def test_state_version_and_derived_stage_from_completeness():
    svc = CommandService(InMemoryPropertyRepository())
    await svc.apply("s", [c.SetProperty(name="X", type="pg", location="Y")])
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    out = to_legacy_session_snapshot(r)
    assert out["stateVersion"] == 2          # two applies
    assert out["stage"] == "structure"       # property complete, structure partial
