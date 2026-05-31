"""Space-tree command layer (heterogeneity Phase A, slice 2).

The uniform command set that replaces AddFloors/SetFloorRooms/RenameRoom/… — applied
through `SpaceTree.apply`, mirroring the existing `Property.apply` pattern. Covers
capacity-from-sharing, structural mutations, grammar + cycle invariants. Pure domain.
"""
from __future__ import annotations

import pytest

from tarini.domain.errors import InvariantViolation, NotFound
from tarini.domain.space import SpaceTree, capacity_for
from tarini.domain import space_commands as sc


def _seq_gen():
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


def _tree():
    return SpaceTree.new("Sunrise PG", id_gen=_seq_gen())


# --------------------------------------------------------------------------- capacity
def test_capacity_from_sharing():
    assert capacity_for("single") == 1
    assert capacity_for("double") == 2
    assert capacity_for("triple") == 3
    assert capacity_for("quad") == 4
    assert capacity_for("dormitory") is None  # needs an explicit count
    assert capacity_for(None) is None


# --------------------------------------------------------------------------- AddSpaces
def test_add_spaces_with_labels():
    t = _tree()
    floor = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["Ground", "First"]))
    assert [s.label for s in floor] == ["Ground", "First"]
    assert [s.label for s in t.children(t.root().id)] == ["Ground", "First"]


def test_add_spaces_by_count_autolabels():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    rooms = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=3))
    assert len(rooms) == 3
    assert [r.label for r in rooms] == ["1", "2", "3"]


def test_add_spaces_carries_sharing_and_derives_capacity():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    rooms = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=2, sharing="double"))
    assert all(r.sharing == "double" and r.capacity == 2 for r in rooms)


def test_add_spaces_enforces_grammar():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1))[0]
    with pytest.raises(InvariantViolation):
        t.apply(sc.AddSpaces(parent_id=r.id, kind="floor", count=1))  # floor in a room


# --------------------------------------------------------------------------- rename / remove
def test_rename_space():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    t.apply(sc.RenameSpace(space_id=f.id, label="Lobby"))
    assert t.get(f.id).label == "Lobby"


def test_remove_space_subtree():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=2))
    t.apply(sc.RemoveSpace(space_id=f.id))
    assert t.children(t.root().id) == []
    assert len(t.spaces) == 1


# --------------------------------------------------------------------------- move (re-parent)
def test_move_space_valid():
    t = _tree()
    f1 = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    f2 = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["1"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f1.id, kind="room", count=1))[0]
    t.apply(sc.MoveSpace(space_id=r.id, new_parent_id=f2.id))
    assert t.get(r.id).parent_id == f2.id
    assert t.children(f1.id) == []


def test_move_rejects_cycle():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1))[0]
    with pytest.raises(InvariantViolation):
        t.apply(sc.MoveSpace(space_id=f.id, new_parent_id=r.id))  # into its own descendant
    with pytest.raises(InvariantViolation):
        t.apply(sc.MoveSpace(space_id=f.id, new_parent_id=f.id))  # into itself


def test_move_rejects_grammar_violation():
    t = _tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1))[0]
    with pytest.raises(InvariantViolation):
        t.apply(sc.MoveSpace(space_id=f.id, new_parent_id=r.id))  # floor under room — also a cycle


# --------------------------------------------------------------------------- set attrs
def test_set_sharing_derives_capacity_and_explicit_for_dorm():
    t = _tree()
    rs = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="room", count=2))
    ids = [r.id for r in rs]
    t.apply(sc.SetSharing(space_ids=ids, sharing="triple"))
    assert all(t.get(i).sharing == "triple" and t.get(i).capacity == 3 for i in ids)
    t.apply(sc.SetSharing(space_ids=ids[:1], sharing="dormitory"))
    t.apply(sc.SetCapacity(space_ids=ids[:1], capacity=8))
    assert t.get(ids[0]).sharing == "dormitory" and t.get(ids[0]).capacity == 8


def test_set_config_and_mark_rentable_unavailable():
    t = _tree()
    flat = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="flat", labels=["A1"]))[0]
    t.apply(sc.SetConfig(space_ids=[flat.id], config="2bhk"))
    t.apply(sc.MarkRentable(space_ids=[flat.id], rentable=True))
    t.apply(sc.MarkUnavailable(space_ids=[flat.id]))
    s = t.get(flat.id)
    assert s.config == "2bhk" and s.rentable is True and s.status == "unavailable"


def test_apply_rejects_unknown_command():
    t = _tree()
    with pytest.raises(InvariantViolation):
        t.apply(object())
