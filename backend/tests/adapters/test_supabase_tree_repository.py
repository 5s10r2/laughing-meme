"""SupabaseTreeRepository tests — round-trip fidelity, optimistic concurrency, the legacy
migrate-on-read seam, and behavioural parity with TreeCommandService — all over FakeSupabase,
which reproduces the migration-0002 CAS (including insert-if-absent) in-process.
"""
from __future__ import annotations

import pytest

from tarini.adapters.supabase_tree_repository import SupabaseTreeRepository
from tarini.application.errors import Conflict
from tarini.application.tree_command_service import TreeCommandService
from tarini.domain import space_commands as sc
from tarini.domain.space import SpaceTree

from .fake_supabase import FakeSupabase

SID = "sess-tree-1"


def _repo(fake=None) -> SupabaseTreeRepository:
    return SupabaseTreeRepository(fake or FakeSupabase())


def _tree(label="Sunrise PG"):
    t = SpaceTree.new(label)
    t.apply(sc.SetProperty(name=label, type="pg", location="HSR"))
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=2, sharing="double"))
    t.version = 1
    return t


async def test_load_missing_returns_none():
    assert await _repo().load(SID) is None


async def test_save_then_load_roundtrips_the_tree():
    r = _repo()
    await r.save(SID, _tree(), expected_version=None)
    loaded = await r.load(SID)
    assert loaded is not None
    assert loaded.meta["name"] == "Sunrise PG" and loaded.version == 1
    rooms = [s for s in loaded.spaces.values() if s.kind == "room"]
    assert len(rooms) == 2 and all(s.capacity == 2 for s in rooms)


async def test_insert_conflict_when_session_exists():
    r = _repo()
    await r.save(SID, _tree("A"), expected_version=None)
    with pytest.raises(Conflict):
        await r.save(SID, _tree("B"), expected_version=None)  # second first-write conflicts


async def test_versioned_update_and_stale_conflict():
    r = _repo()
    t = _tree()
    await r.save(SID, t, expected_version=None)
    t.apply(sc.SetProperty(gender="male"))
    t.version = 2
    await r.save(SID, t, expected_version=1)  # CAS matches
    assert (await r.load(SID)).meta["gender"] == "male"
    with pytest.raises(Conflict):
        await r.save(SID, t, expected_version=1)  # stale → conflict


async def test_migrate_on_read_converts_a_legacy_property_snapshot():
    # seed the SAME table with a LEGACY Property-shaped snapshot (as a pre-cutover session has)
    fake = FakeSupabase()
    fake._snapshots[SID] = {
        "snapshot": {
            "name": "Old PG", "type": "pg", "location": "BTM", "version": 4,
            "blocks": [{"id": "b1", "label": "Main"}],
            "floors": [{"id": "f1", "block_id": "b1", "index": 0, "label": "G", "active": True}],
            "rooms": [{"id": "r1", "floor_id": "f1", "name": "001", "sharing": "double",
                       "package_id": None, "status": "active"}],
            "packages": [],
        },
        "version": 4,
    }
    loaded = await _repo(fake).load(SID)
    assert loaded.meta["name"] == "Old PG" and loaded.version == 4
    rooms = [s for s in loaded.spaces.values() if s.kind == "room"]
    assert len(rooms) == 1 and rooms[0].rentable is True  # migrated to a rentable tree room


async def test_parity_through_service_persists_and_logs():
    fake = FakeSupabase()
    svc = TreeCommandService(_repo(fake))
    snap = await svc.get_model(SID)                       # first-read inserts (version 0)
    root_id = snap["model"]["root_id"]
    snap = await svc.apply(SID, [sc.SetProperty(name="Built", type="pg", location="X")],
                           expected_version=snap["version"])
    assert snap["version"] == 1
    again = await svc.get_model(SID)
    assert again["model"]["meta"]["name"] == "Built" and again["version"] == 1
    assert len(fake.tables.get("command_log", [])) >= 1  # command log appended
