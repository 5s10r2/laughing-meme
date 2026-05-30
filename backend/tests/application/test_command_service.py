"""CommandService tests — atomicity, optimistic concurrency, idempotency, warnings."""
import pytest

from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.application.errors import Conflict
from tarini.domain import commands as c
from tarini.domain.errors import InvariantViolation

SID = "s1"


def svc() -> CommandService:
    return CommandService(InMemoryPropertyRepository())


async def test_get_model_empty():
    r = await svc().get_model(SID)
    assert r["version"] == 0
    assert r["completeness"]["facets"]["structure"] == "empty"
    assert r["completeness"]["publishable"] is False


async def test_apply_batch_bumps_version_and_returns_completeness():
    s = svc()
    r = await s.apply(SID, [c.SetProperty(name="Sunrise", type="pg", location="HSR"),
                            c.AddFloors(count=2)])
    assert r["version"] == 1
    assert len(r["model"]["floors"]) == 2
    assert r["completeness"]["facets"]["property"] == "complete"
    r2 = await s.apply(SID, [c.AddFloors(count=1)])
    assert r2["version"] == 2
    assert len(r2["model"]["floors"]) == 3


async def test_atomic_abort_persists_nothing():
    s = svc()
    await s.apply(SID, [c.CreatePackage(name="Std", rent=8000)])  # v1
    with pytest.raises(InvariantViolation):
        # second command in the batch is a duplicate → whole batch aborts
        await s.apply(SID, [c.AddFloors(count=1), c.CreatePackage(name="std")])
    after = await s.get_model(SID)
    assert after["version"] == 1                      # not bumped
    assert len(after["model"]["packages"]) == 1       # AddFloors NOT persisted
    assert len(after["model"]["floors"]) == 0


async def test_optimistic_concurrency_conflict():
    s = svc()
    await s.apply(SID, [c.SetProperty(name="X")])     # version now 1
    with pytest.raises(Conflict):
        await s.apply(SID, [c.SetProperty(name="Y")], expected_version=0)  # stale
    # correct version succeeds
    r = await s.apply(SID, [c.SetProperty(name="Y")], expected_version=1)
    assert r["version"] == 2 and r["model"]["name"] == "Y"


async def test_idempotency_key_dedupes():
    s = svc()
    r1 = await s.apply(SID, [c.AddFloors(count=1)], idempotency_key="k1")
    r2 = await s.apply(SID, [c.AddFloors(count=1)], idempotency_key="k1")
    assert r1 == r2
    assert (await s.get_model(SID))["version"] == 1   # applied once, not twice


async def test_warnings_surface():
    s = svc()
    r = await s.apply(SID, [c.CreatePackage(name="AC Double")])  # no rent
    assert any("rent" in w for w in r["warnings"])


async def test_command_log_records_entries():
    s = svc()
    repo = s._repo
    await s.apply(SID, [c.SetProperty(name="X"), c.AddFloors(count=1)])
    log = repo._store[SID]["log"]
    assert [e["type"] for e in log] == ["SetProperty", "AddFloors"]
    assert log[0]["v"] == 1 and "args" in log[0]
