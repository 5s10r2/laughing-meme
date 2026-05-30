"""SupabasePropertyRepository tests — round-trip fidelity, optimistic concurrency, command
log, and (the key one) full behavioural parity with the InMemory adapter through CommandService.

Driven by FakeSupabase, which reproduces the migration-0002 CAS semantics in-process.
"""
from __future__ import annotations

import pytest

from tarini.adapters.supabase_repository import SupabasePropertyRepository
from tarini.application.command_service import CommandService
from tarini.application.errors import Conflict
from tarini.domain import commands as c
from tarini.domain.property import Property

from .fake_supabase import FakeSupabase

SID = "sess-1"


def repo() -> SupabasePropertyRepository:
    return SupabasePropertyRepository(FakeSupabase())


# --------------------------------------------------------------------------- repository unit
async def test_load_missing_returns_none():
    assert await repo().load(SID) is None


async def test_save_then_load_roundtrips_aggregate():
    r = repo()
    prop = Property()
    prop.apply(c.SetProperty(name="Sunrise PG", type="pg", location="HSR", gender="female"))
    prop.apply(c.AddFloors(count=2, start_index=1))
    prop.version = 1
    await r.save(SID, prop, expected_version=None)

    loaded = await r.load(SID)
    assert loaded is not None
    assert loaded.name == "Sunrise PG"
    assert loaded.gender == "female"
    assert loaded.version == 1
    assert [f.label for f in loaded.floors] == ["Floor 1", "Floor 2"]


async def test_insert_conflict_when_session_already_exists():
    r = repo()
    p1 = Property(); p1.apply(c.SetProperty(name="A")); p1.version = 1
    await r.save(SID, p1, expected_version=None)
    # a second "first write" (expected_version=None) for the same session is a conflict
    p2 = Property(); p2.apply(c.SetProperty(name="B")); p2.version = 1
    with pytest.raises(Conflict):
        await r.save(SID, p2, expected_version=None)


async def test_versioned_update_and_stale_conflict():
    r = repo()
    p1 = Property(); p1.apply(c.SetProperty(name="A")); p1.version = 1
    await r.save(SID, p1, expected_version=None)

    # correct expected version → succeeds
    p2 = Property.from_dict(p1.to_dict()); p2.apply(c.SetProperty(name="B")); p2.version = 2
    await r.save(SID, p2, expected_version=1)
    assert (await r.load(SID)).name == "B"

    # stale expected version → Conflict, storage untouched
    p3 = Property.from_dict(p2.to_dict()); p3.apply(c.SetProperty(name="C")); p3.version = 3
    with pytest.raises(Conflict):
        await r.save(SID, p3, expected_version=1)
    assert (await r.load(SID)).name == "B"


async def test_append_log_writes_rows_and_noop_on_empty():
    fake = FakeSupabase()
    r = SupabasePropertyRepository(fake)
    await r.append_log(SID, [
        {"v": 1, "type": "SetProperty", "args": {"name": "X"}},
        {"v": 1, "type": "AddFloors", "args": {"count": 2}},
    ])
    rows = fake.tables["command_log"]
    assert [row["command_type"] for row in rows] == ["SetProperty", "AddFloors"]
    assert rows[0]["session_id"] == SID and rows[0]["version"] == 1

    await r.append_log(SID, [])  # no-op, no extra rows
    assert len(fake.tables["command_log"]) == 2


# --------------------------------------------------------------------------- parity via CommandService
async def test_command_service_over_supabase_optimistic_concurrency():
    svc = CommandService(SupabasePropertyRepository(FakeSupabase()))
    await svc.apply(SID, [c.SetProperty(name="X")])              # version → 1
    with pytest.raises(Conflict):
        await svc.apply(SID, [c.SetProperty(name="Y")], expected_version=0)  # stale
    r = await svc.apply(SID, [c.SetProperty(name="Y")], expected_version=1)
    assert r["version"] == 2 and r["model"]["name"] == "Y"


async def test_full_golden_flow_parity_through_supabase_adapter():
    """The same end-to-end onboarding the InMemory golden flows run, but persisted through
    the Supabase adapter — proving the adapter is behaviourally transparent."""
    svc = CommandService(SupabasePropertyRepository(FakeSupabase()))

    await svc.apply(SID, [c.SetProperty(
        owner_name="Ramesh", name="Sunrise PG", type="pg",
        location="Koramangala", gender="male",
    )])
    r = await svc.apply(SID, [c.AddFloors(count=2, start_index=1)])
    f1 = next(f["id"] for f in r["model"]["floors"] if f["label"] == "Floor 1")
    f2 = next(f["id"] for f in r["model"]["floors"] if f["label"] == "Floor 2")

    r = await svc.apply(SID, [
        c.SetFloorRooms(floor_id=f1, count=3),
        c.SetFloorRooms(floor_id=f2, count=3),
    ])
    assert r["completeness"]["facets"]["structure"] == "complete"

    r = await svc.apply(SID, [c.CreatePackage(name="Standard Double", sharing="double", rent=9000)])
    pid = r["model"]["packages"][0]["id"]
    room_ids = [rm["id"] for rm in r["model"]["rooms"]]

    r = await svc.apply(SID, [c.MapRooms(room_ids=room_ids, package_id=pid)])
    assert r["completeness"]["publishable"] is True
    assert r["completeness"]["counts"]["rooms_mapped"] == 6

    r = await svc.apply(SID, [c.Publish()])  # raises if blocked
    assert r["version"] == 6

    # the snapshot truly persisted: a fresh service over the SAME store reads it back
    reloaded = await svc.get_model(SID)
    assert reloaded["version"] == 6
    assert reloaded["model"]["name"] == "Sunrise PG"
    assert len(reloaded["model"]["rooms"]) == 6
