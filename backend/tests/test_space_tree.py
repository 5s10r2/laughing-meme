"""The Space tree — the recursive inventory aggregate (heterogeneity Phase A).

One node type (`Space`) nests by a validated containment grammar (rank rule), so a PG
(shallow) and an apartment building (deep) are the same tree at different depths. These
cover the grammar + the tree's structural operations. No I/O, pure domain.
"""
from __future__ import annotations

import pytest

from tarini.domain.errors import InvariantViolation, NotFound
from tarini.domain.space import KIND_RANK, Space, SpaceTree, can_contain


def _seq_gen():
    """Deterministic id generator for tests: prop_0, floor_1, room_2 …"""
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


# --------------------------------------------------------------------------- grammar
def test_kind_rank_is_a_strict_order():
    assert (KIND_RANK["property"] < KIND_RANK["block"] < KIND_RANK["floor"]
            < KIND_RANK["flat"] < KIND_RANK["room"] < KIND_RANK["bed"])


def test_can_contain_only_strictly_higher_rank():
    assert can_contain("property", "room")   # levels are skippable
    assert can_contain("floor", "room")
    assert can_contain("flat", "room")
    assert can_contain("room", "bed")
    assert not can_contain("room", "floor")  # inverted
    assert not can_contain("floor", "floor")  # same rank
    assert not can_contain("bed", "room")     # bed is a leaf
    assert not can_contain("room", "nonsense")  # unknown kind


# --------------------------------------------------------------------------- tree
def test_tree_new_has_a_property_root():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    assert t.root().kind == "property"
    assert t.root().label == "Sunrise PG"
    assert t.root().parent_id is None


def test_add_children_following_the_grammar():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    floor = t.add(t.root().id, "floor", "Ground")
    room = t.add(floor.id, "room", "001")
    assert isinstance(floor, Space) and floor.kind == "floor"
    assert room.kind == "room" and room.parent_id == floor.id
    assert [c.id for c in t.children(t.root().id)] == [floor.id]
    assert [c.id for c in t.children(floor.id)] == [room.id]


def test_levels_are_skippable():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    room = t.add(t.root().id, "room", "1")  # property → room, skipping floor/flat
    assert room.parent_id == t.root().id


def test_rejects_inverted_or_same_rank_nesting():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    floor = t.add(t.root().id, "floor", "G")
    room = t.add(floor.id, "room", "1")
    with pytest.raises(InvariantViolation):
        t.add(room.id, "floor", "bad")  # floor inside a room
    with pytest.raises(InvariantViolation):
        t.add(floor.id, "floor", "bad")  # floor inside a floor (same rank)


def test_rejects_unknown_parent_and_unknown_kind():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    with pytest.raises(NotFound):
        t.add("ghost", "floor", "G")
    with pytest.raises(InvariantViolation):
        t.add(t.root().id, "wing", "bad")  # not a known kind


def test_children_are_ordered_by_insertion():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    f = t.add(t.root().id, "floor", "G")
    a = t.add(f.id, "room", "1")
    b = t.add(f.id, "room", "2")
    c = t.add(f.id, "room", "3")
    assert [r.label for r in t.children(f.id)] == ["1", "2", "3"]
    assert [r.id for r in t.children(f.id)] == [a.id, b.id, c.id]


def test_descendants_walks_the_subtree():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    f = t.add(t.root().id, "floor", "G")
    r1 = t.add(f.id, "room", "1")
    r2 = t.add(f.id, "room", "2")
    bed = t.add(r1.id, "bed", "1A")
    assert {s.id for s in t.descendants(t.root().id)} == {f.id, r1.id, r2.id, bed.id}
    assert {s.id for s in t.descendants(f.id)} == {r1.id, r2.id, bed.id}


def test_remove_drops_the_whole_subtree():
    t = SpaceTree.new("PG", id_gen=_seq_gen())
    f = t.add(t.root().id, "floor", "G")
    r = t.add(f.id, "room", "1")
    t.add(r.id, "bed", "1A")
    t.remove(f.id)
    assert f.id not in t.spaces
    assert t.children(t.root().id) == []
    assert len(t.spaces) == 1  # only the root remains
