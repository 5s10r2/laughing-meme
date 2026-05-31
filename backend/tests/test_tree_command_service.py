"""TreeCommandService (heterogeneity Phase D, step 2).

Same contract as CommandService — get_model/apply, optimistic concurrency, idempotency,
batch atomicity — over the SpaceTree, plus migrate-on-read of legacy snapshots.
"""
from __future__ import annotations

import pytest

from tarini.adapters.inmemory_tree_repository import InMemoryTreeRepository
from tarini.application.errors import Conflict
from tarini.application.tree_command_service import TreeCommandService
from tarini.domain import space_commands as sc
from tarini.domain.errors import NotFound


def _svc():
    return TreeCommandService(InMemoryTreeRepository())


async def _seed(svc, session="s1"):
    snap = await svc.apply(session, [
        sc.SetProperty(name="Sunrise PG", type="pg", location="HSR"),
    ])
    root_id = snap["model"]["root_id"]
    snap = await svc.apply(session, [
        sc.AddSpaces(parent_id=root_id, kind="room", count=2, sharing="double"),
    ], expected_version=snap["version"])
    return snap


@pytest.mark.asyncio
async def test_new_session_is_empty_and_unpublishable():
    snap = await _svc().get_model("new")
    assert snap["version"] == 0
    assert snap["completeness"]["publishable"] is False
    assert snap["model"]["spaces"]  # at least the root


@pytest.mark.asyncio
async def test_apply_persists_and_increments_version():
    svc = _svc()
    snap = await _seed(svc)
    assert snap["version"] == 2
    assert snap["model"]["meta"]["name"] == "Sunrise PG"
    rooms = [s for s in snap["model"]["spaces"] if s["kind"] == "room"]
    assert len(rooms) == 2 and all(r["capacity"] == 2 for r in rooms)
    # reload sees the same persisted state
    again = await svc.get_model("s1")
    assert again["version"] == 2


@pytest.mark.asyncio
async def test_batch_is_atomic_on_failure():
    svc = _svc()
    snap = await _seed(svc)
    root_id = snap["model"]["root_id"]
    with pytest.raises(NotFound):
        await svc.apply("s1", [
            sc.AddSpaces(parent_id=root_id, kind="floor", labels=["G"]),  # would succeed
            sc.RenameSpace(space_id="ghost", label="X"),                  # fails
        ], expected_version=snap["version"])
    # nothing from the failed batch persisted — version + structure unchanged
    after = await svc.get_model("s1")
    assert after["version"] == 2
    assert not [s for s in after["model"]["spaces"] if s["kind"] == "floor"]


@pytest.mark.asyncio
async def test_optimistic_concurrency_conflict():
    svc = _svc()
    snap = await _seed(svc)
    with pytest.raises(Conflict):
        await svc.apply("s1", [sc.SetProperty(gender="male")], expected_version=snap["version"] - 1)


@pytest.mark.asyncio
async def test_idempotency_key_returns_cached():
    svc = _svc()
    await _seed(svc)
    base = (await svc.get_model("s1"))["version"]
    first = await svc.apply("s1", [sc.SetProperty(gender="male")],
                            expected_version=base, idempotency_key="k1")
    second = await svc.apply("s1", [sc.SetProperty(gender="female")],
                             expected_version=base, idempotency_key="k1")
    assert second == first  # replayed, not re-applied
    assert (await svc.get_model("s1"))["model"]["meta"]["gender"] == "male"


@pytest.mark.asyncio
async def test_migrate_on_read_from_legacy_snapshot():
    repo = InMemoryTreeRepository()
    # pre-seed the store with a LEGACY Property snapshot (as an old session would have)
    repo._store["old"] = {
        "snapshot": {
            "name": "Old PG", "type": "pg", "location": "BTM", "version": 5,
            "blocks": [{"id": "b1", "label": "Main"}],
            "floors": [{"id": "f1", "block_id": "b1", "index": 0, "label": "G", "active": True}],
            "rooms": [{"id": "r1", "floor_id": "f1", "name": "001", "sharing": "double",
                       "package_id": None, "status": "active"}],
            "packages": [],
        },
        "log": [],
    }
    svc = TreeCommandService(repo)
    snap = await svc.get_model("old")
    assert snap["model"]["meta"]["name"] == "Old PG"
    assert snap["version"] == 5
    rooms = [s for s in snap["model"]["spaces"] if s["kind"] == "room"]
    assert len(rooms) == 1 and rooms[0]["rentable"] is True
