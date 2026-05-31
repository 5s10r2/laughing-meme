"""Serialization + legacy migration (Phase A, slice 4).

`to_dict`/`from_dict` are the tree's own persistence format (round-trips losslessly).
`from_legacy` converts a stored legacy Property snapshot (blocks/floors/rooms/packages)
into the recursive tree — a single "Main" block collapses away (property → floor → room),
multiple blocks are preserved, packages become offerings, room↔package links carry over.
"""
from __future__ import annotations

from tarini.domain.space import SpaceTree, capacity_for
from tarini.domain import space_commands as sc


def _seq_gen():
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


# --------------------------------------------------------------------------- round-trip
def test_to_from_dict_round_trips():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    t.meta = {"owner_name": "Ravi", "type": "pg", "location": "HSR", "gender": "male"}
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    rooms = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=2, sharing="double"))
    off = t.apply(sc.CreateOffering(name="AC Double", price=9000, attrs={"ac": True}))
    t.apply(sc.MapOffering(space_ids=[rooms[0].id], offering_id=off.id))

    data = t.to_dict()
    t2 = SpaceTree.from_dict(data)
    assert t2.to_dict() == data
    assert t2.meta["owner_name"] == "Ravi"
    assert t2.get(rooms[0].id).offering_id == off.id
    assert t2.offerings[off.id].ac is True
    assert [s.label for s in t2.children(f.id)] == ["1", "2"]


# --------------------------------------------------------------------------- legacy migration
def _legacy_pg():
    """A typical stored single-block PG snapshot."""
    return {
        "owner_name": "Ravi", "name": "Sunrise PG", "type": "pg",
        "location": "HSR, Bangalore", "gender": "male", "version": 7,
        "blocks": [{"id": "blk1", "label": "Main"}],
        "floors": [
            {"id": "fl2", "block_id": "blk1", "index": 1, "label": "First", "active": True},
            {"id": "fl1", "block_id": "blk1", "index": 0, "label": "Ground", "active": True},
        ],
        "rooms": [
            {"id": "r1", "floor_id": "fl1", "name": "001", "category": "room",
             "sharing": "double", "package_id": "pk1", "status": "active"},
            {"id": "r2", "floor_id": "fl1", "name": "002", "category": "room",
             "sharing": "triple", "package_id": None, "status": "active"},
        ],
        "packages": [
            {"id": "pk1", "name": "AC Double", "sharing": "double", "ac": True,
             "food": "included", "furnishing": "fully_furnished", "rent": 9000,
             "amenities": ["wifi", "geyser"], "active": True},
        ],
        "naming": {},
    }


def test_from_legacy_single_block_collapses():
    t = SpaceTree.from_legacy(_legacy_pg(), id_gen=_seq_gen())
    assert t.root().kind == "property" and t.root().label == "Sunrise PG"
    assert t.meta == {"name": "Sunrise PG", "owner_name": "Ravi", "type": "pg",
                      "location": "HSR, Bangalore", "gender": "male"}
    assert t.version == 7
    # single "Main" block collapses → floors hang directly off the property
    kinds = {s.kind for s in t.children(t.root().id)}
    assert kinds == {"floor"}
    # floors ordered by their legacy index
    assert [f.label for f in t.children(t.root().id)] == ["Ground", "First"]


def test_from_legacy_rooms_and_capacity():
    t = SpaceTree.from_legacy(_legacy_pg(), id_gen=_seq_gen())
    ground = [f for f in t.children(t.root().id) if f.label == "Ground"][0]
    rooms = t.children(ground.id)
    assert [r.label for r in rooms] == ["001", "002"]
    assert rooms[0].sharing == "double" and rooms[0].capacity == 2
    assert rooms[1].sharing == "triple" and rooms[1].capacity == 3


def test_from_legacy_packages_become_offerings_and_links_carry():
    t = SpaceTree.from_legacy(_legacy_pg(), id_gen=_seq_gen())
    assert len(t.offerings) == 1
    off = next(iter(t.offerings.values()))
    assert off.name == "AC Double" and off.price == 9000 and off.ac is True
    assert off.food == "included" and off.amenities == ["wifi", "geyser"]
    ground = [f for f in t.children(t.root().id) if f.label == "Ground"][0]
    rooms = t.children(ground.id)
    assert rooms[0].offering_id == off.id and rooms[0].rentable is True
    assert rooms[1].offering_id is None  # had no package


def test_from_legacy_multi_block_preserved():
    data = _legacy_pg()
    data["blocks"] = [{"id": "blk1", "label": "A Wing"}, {"id": "blk2", "label": "B Wing"}]
    data["floors"] = [{"id": "fl1", "block_id": "blk2", "index": 0, "label": "G", "active": True}]
    data["rooms"] = []
    t = SpaceTree.from_legacy(data, id_gen=_seq_gen())
    blocks = t.children(t.root().id)
    assert [b.kind for b in blocks] == ["block", "block"]
    assert [b.label for b in blocks] == ["A Wing", "B Wing"]
    bwing = [b for b in blocks if b.label == "B Wing"][0]
    assert [f.label for f in t.children(bwing.id)] == ["G"]


def test_from_legacy_empty_is_safe():
    t = SpaceTree.from_legacy({"name": "Bare"}, id_gen=_seq_gen())
    assert t.root().label == "Bare"
    assert t.children(t.root().id) == []
    assert t.offerings == {}
