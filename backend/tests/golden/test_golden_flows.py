"""Golden conversation flows — the eval safety net for the backend redesign.

Each test is a full onboarding session expressed as the command batches the agent would
emit, asserting the model + completeness after every turn. These are the regression
contract: the agent tool layer, prompt, and server rewire (A2–A5) must keep these green.

Stages are conceptual now (the model is facet-driven, not gate-driven), but the flows are
named for the classic IA — intro → structure → packages → mapping → verification — so a
failure points at the part of the conversation that drifted.

Run: pytest tests/golden -q
"""
from __future__ import annotations

import pytest

from tarini.domain import commands as c
from tarini.domain.errors import InvariantViolation, PublishBlocked

from .flow import Flow


# ===========================================================================
# Flow 1 — Happy path: a small co-living PG, intro → publish, in stage order.
# ===========================================================================
async def test_happy_path_pg_full_onboarding():
    f = await Flow("happy-pg").start()
    assert f.completeness["facets"]["structure"] == "empty"
    assert f.completeness["publishable"] is False

    # ---- intro: owner describes the property in one breath ----
    await f.turn(
        c.SetProperty(
            owner_name="Ramesh", name="Sunrise PG", type="pg",
            location="Koramangala, Bengaluru", gender="male",
        )
    )
    assert f.facets["property"] == "complete"
    assert f.model["gender"] == "male"
    assert f.facets["structure"] == "empty"  # nothing built yet

    # ---- structure: two floors, rooms on each ----
    await f.turn(c.AddFloors(count=2, start_index=1))
    assert [fl["label"] for fl in f.model["floors"]] == ["Floor 1", "Floor 2"]
    assert f.facets["structure"] == "partial"  # floors exist, no rooms yet

    await f.turn(
        c.SetFloorRooms(floor_id=f.floor_id("Floor 1"), count=3),
        c.SetFloorRooms(floor_id=f.floor_id("Floor 2"), count=3),
    )
    assert len(f.model["rooms"]) == 6
    assert f.facets["structure"] == "complete"  # every active floor has rooms

    # ---- packages: one standard sharing package with rent ----
    await f.turn(c.CreatePackage(name="Standard Double", sharing="double", rent=9000, food="included"))
    assert f.facets["packages"] == "complete"
    assert f.facets["mapping"] == "empty"  # created, nothing mapped

    # ---- mapping: all six rooms → the standard package ----
    all_rooms = f.room_ids_on("Floor 1") + f.room_ids_on("Floor 2")
    await f.turn(c.MapRooms(room_ids=all_rooms, package_id=f.package_id("Standard Double")))
    assert f.facets["mapping"] == "complete"
    assert f.completeness["counts"]["rooms_mapped"] == 6

    # ---- verification: fully complete → publishable, Publish succeeds ----
    assert f.completeness["publishable"] is True
    assert f.completeness["open_items"] == []
    await f.turn(c.Publish())  # raises if blocked — proves the gate is open
    assert f.snapshot["version"] == 6  # one bump per turn


# ===========================================================================
# Flow 2 — Talk-or-touch: owner works facets out of order (packages before
# structure is done), proving the redesign is not gate-locked.
# ===========================================================================
async def test_out_of_order_facets_no_linear_gate():
    f = await Flow("out-of-order").start()

    # owner jumps straight to pricing before any floors exist
    await f.turn(c.CreatePackage(name="AC Single", sharing="single", ac=True, rent=15000))
    assert f.facets["packages"] == "complete"
    assert f.facets["structure"] == "empty"
    assert f.completeness["publishable"] is False  # no property, no floors

    # then backfills the intro
    await f.turn(c.SetProperty(name="Metro Stay", type="pg", location="HSR"))
    assert f.facets["property"] == "complete"

    # then structure
    await f.turn(c.AddFloors(count=1, start_index=1))
    await f.turn(c.SetFloorRooms(floor_id=f.floor_id("Floor 1"), count=2))
    assert f.facets["structure"] == "complete"

    # map and it's publishable — order never mattered
    await f.turn(c.MapRooms(room_ids=f.room_ids_on("Floor 1"), package_id=f.package_id("AC Single")))
    assert f.completeness["publishable"] is True


# ===========================================================================
# Flow 3 — Mixed room types + naming pattern (a realistic multi-type floor).
# ===========================================================================
async def test_mixed_room_types_and_naming():
    f = await Flow("mixed-types").start()
    await f.turn(c.SetProperty(name="Galaxy Residency", type="pg", location="Whitefield"))
    await f.turn(c.AddFloors(count=1, start_index=1))
    fid = f.floor_id("Floor 1")

    # 4 rooms: 2 single, 2 double, named like 1-01 … 1-04
    await f.turn(c.SetNamingPattern(scope="all", pattern="{floor}-{nn}", start=1))
    await f.turn(c.SetFloorRooms(floor_id=fid, count=4, type_mix={"single": 2, "double": 2}))

    names = sorted(r["name"] for r in f.model["rooms"])
    assert names == ["1-01", "1-02", "1-03", "1-04"]
    cats = sorted(r["category"] for r in f.model["rooms"])
    assert cats == ["double", "double", "single", "single"]

    # two packages, one per type
    await f.turn(
        c.CreatePackage(name="Single Deluxe", sharing="single", rent=12000),
        c.CreatePackage(name="Double Standard", sharing="double", rent=8000),
    )
    singles = [r["id"] for r in f.model["rooms"] if r["category"] == "single"]
    doubles = [r["id"] for r in f.model["rooms"] if r["category"] == "double"]
    await f.turn(
        c.MapRooms(room_ids=singles, package_id=f.package_id("Single Deluxe")),
        c.MapRooms(room_ids=doubles, package_id=f.package_id("Double Standard")),
    )
    assert f.facets["mapping"] == "complete"
    assert f.completeness["publishable"] is True


# ===========================================================================
# Flow 4 — Corrections: owner changes their mind mid-flow (rename, remap,
# disable a package, mark a room unavailable). The drill-down editing story.
# ===========================================================================
async def test_corrections_rename_remap_disable_unavailable():
    f = await Flow("corrections").start()
    await f.turn(c.SetProperty(name="Cozy Nest", type="pg", location="Indiranagar"))
    await f.turn(c.AddFloors(count=1, start_index=1))
    fid = f.floor_id("Floor 1")
    await f.turn(c.SetFloorRooms(floor_id=fid, count=3))
    await f.turn(
        c.CreatePackage(name="Basic", sharing="triple", rent=6000),
        c.CreatePackage(name="Premium", sharing="single", rent=14000),
    )
    rooms = f.room_ids_on("Floor 1")
    await f.turn(c.MapRooms(room_ids=rooms, package_id=f.package_id("Basic")))
    assert len(f.rooms_for_package("Basic")) == 3

    # owner renames the floor
    await f.turn(c.RenameFloor(floor_id=fid, label="Ground Floor"))
    assert f.floor_id("Ground Floor")  # lookup by new label works

    # remap one room from Basic → Premium
    await f.turn(c.MapRooms(room_ids=[rooms[0]], package_id=f.package_id("Premium")))
    assert len(f.rooms_for_package("Basic")) == 2
    assert len(f.rooms_for_package("Premium")) == 1

    # one room goes out of service → mapping stays complete (unavailable rooms excluded)
    await f.turn(c.MarkUnavailable(room_ids=[rooms[1]]))
    assert f.facets["mapping"] == "complete"
    assert f.completeness["publishable"] is True

    # cannot delete a package that still has mapped rooms
    with pytest.raises(InvariantViolation):
        await f.turn(c.DeletePackage(package_id=f.package_id("Basic")))
    # snapshot unchanged after the failed turn (atomic abort)
    assert any(p["name"] == "Basic" for p in f.model["packages"])


# ===========================================================================
# Flow 5 — Verification gate: Publish is blocked with actionable open_items,
# then each item is resolved until publish goes green. This is the safety net
# for the verification stage specifically.
# ===========================================================================
async def test_publish_gate_blocks_then_clears_with_open_items():
    f = await Flow("gate").start()

    # property only — many open items
    await f.turn(c.SetProperty(name="Half Built", type="pg", location="BTM"))
    items = f.completeness["open_items"]
    assert any("floor" in i.lower() for i in items)
    assert any("package" in i.lower() for i in items)
    with pytest.raises(PublishBlocked) as ei:
        await f.turn(c.Publish())
    assert ei.value.open_items  # carries the reasons for the UI

    # add structure → 'no floors' clears, 'no rooms mapped'/'no packages' remain
    await f.turn(c.AddFloors(count=1, start_index=1))
    await f.turn(c.SetFloorRooms(floor_id=f.floor_id("Floor 1"), count=2))
    assert not any("no floors" in i.lower() for i in f.completeness["open_items"])

    # add a package WITHOUT rent → 'no starting rent' open item surfaces
    await f.turn(c.CreatePackage(name="Standard", sharing="double"))
    assert any("rent" in i.lower() for i in f.completeness["open_items"])
    assert any("rent" in w.lower() for w in f.warnings)  # warned at creation too

    # set the rent
    await f.turn(c.UpdatePackage(package_id=f.package_id("Standard"), rent=8000))
    assert not any("rent" in i.lower() for i in f.completeness["open_items"])

    # still blocked on mapping
    assert any("map" in i.lower() for i in f.completeness["open_items"])
    with pytest.raises(PublishBlocked):
        await f.turn(c.Publish())

    # map the rooms → fully clear → publish succeeds
    await f.turn(c.MapRooms(room_ids=f.room_ids_on("Floor 1"), package_id=f.package_id("Standard")))
    assert f.completeness["open_items"] == []
    await f.turn(c.Publish())
