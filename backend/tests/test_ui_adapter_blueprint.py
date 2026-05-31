"""Phase B UI-adapter projections — model → Living Blueprint component props.

Pure presentation projections (no colour — the frontend maps category → palette).
Driven through real CommandService snapshots, no mocks.
"""
from __future__ import annotations

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.domain import commands as c
from tarini.ui_adapter import (
    massing_props,
    floor_ledger_props,
    mapping_props,
    unmapped_props,
    package_panel_props,
)


async def _built() -> dict:
    """A 2-floor PG: Floor 1 has 3 rooms (2 single, 1 double) with 2 mapped to a
    package + 1 unmapped; Floor 2 has no rooms yet. Returns the snapshot."""
    svc = CommandService(InMemoryPropertyRepository())
    await svc.apply("s", [c.SetProperty(name="Sunrise PG", type="pg", location="HSR")])
    r = await svc.apply("s", [c.AddFloors(count=2, start_index=1)])
    f1 = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f1, count=3, type_mix={"single": 2, "double": 1})])
    r = await svc.apply("s", [c.CreatePackage(name="AC Single", sharing="single", rent=9000)])
    pkg = r["model"]["packages"][0]["id"]
    f1_rooms = [room["id"] for room in r["model"]["rooms"] if room["floor_id"] == f1]
    r = await svc.apply("s", [c.MapRooms(room_ids=f1_rooms[:2], package_id=pkg)])
    return r


# --------------------------------------------------------------------------- massing
async def test_massing_props_blocks_and_stats():
    m = (await _built())["model"]
    out = massing_props(m)
    assert out["propertyName"] == "Sunrise PG"
    assert out["blocks"] == [{"label": "Main", "floors": 2, "accentTop": True}]
    stats = {s["label"]: s["value"] for s in out["stats"]}
    assert stats["Floors"] == 2
    assert stats["Rooms"] == 3
    assert stats["Types"] == 2  # single, double
    # meta composes type + location ("PG · HSR"); owner present as a field (None here)
    assert "HSR" in out["meta"] and "PG" in out["meta"]
    assert out["owner"] is None


async def test_massing_props_meta_includes_gender_and_owner():
    svc = CommandService(InMemoryPropertyRepository())
    await svc.apply("s", [c.SetProperty(
        owner_name="Ramesh", name="Sunrise PG", type="pg", location="HSR", gender="male",
    )])
    out = massing_props((await svc.get_model("s"))["model"])
    assert out["meta"] == "Men's PG · HSR"   # gender + type + location, labelled
    assert out["owner"] == "Ramesh"


async def test_massing_props_empty_model():
    out = massing_props({})
    assert out["blocks"] == []
    assert {s["label"]: s["value"] for s in out["stats"]}["Floors"] == 0
    assert out["propertyName"] == "Your property"


# --------------------------------------------------------------------------- floor ledger
async def test_floor_ledger_top_down_with_mix_and_units():
    m = (await _built())["model"]
    floors = floor_ledger_props(m)["floors"]
    # top-down: Floor 2 (index 2) first, Floor 1 second
    assert [f["name"] for f in floors] == ["Floor 2", "Floor 1"]
    top, ground = floors
    assert top["rooms"] == 0 and top["segments"] == [] and top["units"] == []
    assert ground["rooms"] == 3
    seg = {s["key"]: s["count"] for s in ground["segments"]}
    assert seg == {"single": 2, "double": 1}
    assert all(set(s) == {"key", "label", "count"} for s in ground["segments"])  # no colour
    assert len(ground["units"]) == 3
    assert ground["mapped"] is False  # only 2 of 3 mapped
    assert isinstance(ground["nameRange"], str) and len(ground["nameRange"]) > 0


async def test_floor_ledger_empty_model():
    assert floor_ledger_props({}) == {"floors": []}


# --------------------------------------------------------------------------- mapping
async def test_mapping_props_packages_and_per_floor_units():
    m = (await _built())["model"]
    out = mapping_props(m)
    assert [p["name"] for p in out["packages"]] == ["AC Single"]
    # Floor 2 (no rooms) is excluded; only Floor 1 appears
    assert [f["floorLabel"] for f in out["floors"]] == ["Floor 1"]
    units = out["floors"][0]["units"]
    assert len(units) == 3
    mapped = [u for u in units if u["packageId"]]
    unmapped = [u for u in units if not u["packageId"]]
    assert len(mapped) == 2 and len(unmapped) == 1
    assert all(set(u) == {"id", "name", "category", "packageId"} for u in units)


# --------------------------------------------------------------------------- unmapped roll-up
# --------------------------------------------------------------------------- package panel
async def test_package_panel_props_details_and_room_count():
    m = (await _built())["model"]
    out = package_panel_props(m)
    assert [p["name"] for p in out["packages"]] == ["AC Single"]
    pkg = out["packages"][0]
    assert pkg["sharing"] == "single" and pkg["rent"] == 9000
    assert set(pkg) == {"id", "name", "sharing", "ac", "food", "furnishing", "rent", "amenities", "roomCount"}
    assert pkg["roomCount"] == 2  # 2 of the 3 ground-floor rooms are mapped to it
    assert "color" not in str(out)  # colourless — frontend assigns a palette


async def test_package_panel_props_excludes_disabled():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.CreatePackage(name="Std", rent=5000)])
    assert [p["name"] for p in package_panel_props(r["model"])["packages"]] == ["Std"]
    pid = r["model"]["packages"][0]["id"]
    r = await svc.apply("s", [c.DisablePackage(package_id=pid)])
    assert package_panel_props(r["model"])["packages"] == []  # inactive not shown


async def test_unmapped_props_only_floors_with_unmapped():
    m = (await _built())["model"]
    out = unmapped_props(m)
    assert [f["floorLabel"] for f in out["floors"]] == ["Floor 1"]  # Floor 2 has 0 rooms
    units = out["floors"][0]["units"]
    assert len(units) == 1  # the one unmapped room
    assert set(units[0]) == {"id", "name"}


async def test_unmapped_props_empty_when_all_mapped():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    f = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f, count=2)])
    r = await svc.apply("s", [c.CreatePackage(name="Std", rent=5000)])
    pkg = r["model"]["packages"][0]["id"]
    ids = [room["id"] for room in r["model"]["rooms"]]
    r = await svc.apply("s", [c.MapRooms(room_ids=ids, package_id=pkg)])
    assert unmapped_props(r["model"]) == {"floors": []}


# ----------------------------------------------------- dangling / inactive package
async def test_inactive_package_makes_rooms_unmapped():
    """DisablePackage leaves a stale package_id on rooms — they must read as
    unmapped (matches the frontend isMapped), not silently 'mapped'."""
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    f = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f, count=2)])
    r = await svc.apply("s", [c.CreatePackage(name="AC", rent=8000)])
    pkg = r["model"]["packages"][0]["id"]
    ids = [room["id"] for room in r["model"]["rooms"]]
    r = await svc.apply("s", [c.MapRooms(room_ids=ids, package_id=pkg)])
    assert floor_ledger_props(r["model"])["floors"][0]["mapped"] is True  # sanity
    assert unmapped_props(r["model"]) == {"floors": []}

    r = await svc.apply("s", [c.DisablePackage(package_id=pkg)])  # rooms keep stale id
    m = r["model"]
    assert floor_ledger_props(m)["floors"][0]["mapped"] is False
    assert sum(len(fl["units"]) for fl in unmapped_props(m)["floors"]) == 2
    assert mapping_props(m)["packages"] == []  # inactive package isn't offered


# ----------------------------------------------------- active-only filtering
async def test_unavailable_room_excluded_from_all_projections():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    f = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f, count=3)])
    rid = r["model"]["rooms"][0]["id"]
    r = await svc.apply("s", [c.MarkUnavailable(room_ids=[rid])])
    m = r["model"]
    assert floor_ledger_props(m)["floors"][0]["rooms"] == 2
    assert {s["label"]: s["value"] for s in massing_props(m)["stats"]}["Rooms"] == 2
    assert sum(len(fl["units"]) for fl in mapping_props(m)["floors"]) == 2


# ----------------------------------------------------- name range natural sort
async def test_name_range_natural_sort_mixed_width():
    svc = CommandService(InMemoryPropertyRepository())
    r = await svc.apply("s", [c.AddFloors(count=1, start_index=1)])
    f = r["model"]["floors"][0]["id"]
    r = await svc.apply("s", [c.SetFloorRooms(floor_id=f, count=3)])
    rooms = [room["id"] for room in r["model"]["rooms"]]
    for rid, name in zip(rooms, ["9", "10", "11"]):
        r = await svc.apply("s", [c.RenameRoom(room_id=rid, name=name)])
    assert floor_ledger_props(r["model"])["floors"][0]["nameRange"] == "9–11"
