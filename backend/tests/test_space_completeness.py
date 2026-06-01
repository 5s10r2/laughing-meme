"""Completeness re-derived from the tree (Phase A, slice 5).

Same contract the legacy engine exposed (facets / open_items / publishable / counts) but
computed generically over the recursive tree via the `rentable` marker — so it works for
a PG (rooms sell), a flat building (flats sell), or per-bed, with no special-casing.
"""
from __future__ import annotations

from tarini.domain.space import SpaceTree
from tarini.domain import space_commands as sc
from tarini.domain.space_completeness import compute_completeness, publish_open_items


def _seq_gen():
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


def _named_tree():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    t.meta = {"name": "Sunrise PG", "type": "pg", "location": "HSR", "gender": "male"}
    return t


# Full offering terms — price + deposit + notice + lock-in, the publish-ready set.
_FULL_TERMS = {"deposit_months": 2, "notice_days": 30, "lock_in_months": 0}


def _publishable_tree():
    """name+type+location+gender, one floor with two rentable rooms, one fully-specified
    offering (priced + deposit + notice + lock-in), all mapped."""
    t = _named_tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    rooms = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=2, sharing="double"))
    ids = [r.id for r in rooms]
    t.apply(sc.MarkRentable(space_ids=ids))
    off = t.apply(sc.CreateOffering(name="AC Double", price=9000, attrs=dict(_FULL_TERMS)))
    t.apply(sc.MapOffering(space_ids=ids, offering_id=off.id))
    return t, ids, off


# --------------------------------------------------------------------------- empty
def test_empty_tree_is_not_publishable():
    t = SpaceTree.new("Property", id_gen=_seq_gen())  # no meta name/type/location
    c = compute_completeness(t)
    assert c["publishable"] is False
    assert c["facets"]["property"] == "empty"
    assert c["facets"]["structure"] == "empty"
    items = publish_open_items(t)
    assert "Needs a property name" in items
    assert "Needs a property type" in items
    assert "Needs a location" in items
    assert any("gender preference" in i for i in items)
    assert "No rentable inventory added yet" in items
    assert "No offerings created yet" in items


# --------------------------------------------------------------------------- facets
def test_property_facet_partial_then_complete():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    t.meta = {"name": "Sunrise PG"}  # only name
    assert compute_completeness(t)["facets"]["property"] == "partial"
    t.meta = {"name": "Sunrise PG", "type": "pg", "location": "HSR"}  # still missing gender
    assert compute_completeness(t)["facets"]["property"] == "partial"
    t.meta = {"name": "Sunrise PG", "type": "pg", "location": "HSR", "gender": "male"}
    assert compute_completeness(t)["facets"]["property"] == "complete"


def test_structure_partial_with_only_containers():
    t = _named_tree()
    t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))  # a floor, no units
    c = compute_completeness(t)
    assert c["facets"]["structure"] == "partial"  # structure exists, nothing sellable yet


def test_mapping_partial_then_complete():
    t, ids, off = _publishable_tree()
    t.apply(sc.UnmapOffering(space_ids=ids[:1]))
    c = compute_completeness(t)
    assert c["facets"]["mapping"] == "partial"
    assert c["publishable"] is False
    assert any("not mapped" in i for i in c["open_items"])
    t.apply(sc.MapOffering(space_ids=ids[:1], offering_id=off.id))
    assert compute_completeness(t)["facets"]["mapping"] == "complete"


def test_offerings_facet_needs_price():
    t = _named_tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1))[0]
    t.apply(sc.MarkRentable(space_ids=[r.id]))
    off = t.apply(sc.CreateOffering(name="No price yet"))  # price None
    c = compute_completeness(t)
    assert c["facets"]["offerings"] == "partial"
    assert any("has no starting rent" in i for i in c["open_items"])


# --------------------------------------------------------------------------- publishable + counts
def test_publishable_tree_is_ready_with_counts():
    t, ids, off = _publishable_tree()
    c = compute_completeness(t)
    assert c["publishable"] is True
    assert c["open_items"] == []
    assert c["facets"] == {"property": "complete", "structure": "complete",
                           "offerings": "complete", "mapping": "complete"}
    assert c["counts"]["rentable"] == 2
    assert c["counts"]["rentable_mapped"] == 2
    assert c["counts"]["offerings"] == 1


def test_unavailable_units_excluded_from_mapping():
    t, ids, off = _publishable_tree()
    t.apply(sc.UnmapOffering(space_ids=ids[:1]))
    t.apply(sc.MarkUnavailable(space_ids=ids[:1]))  # taken off the market
    c = compute_completeness(t)
    assert c["facets"]["mapping"] == "complete"  # only active rentable units count
    assert c["publishable"] is True


# --------------------------------------------------------------------------- P0 fields
def test_gender_required_for_publish():
    """A property with everything except gender cannot publish."""
    t, ids, off = _publishable_tree()
    assert compute_completeness(t)["publishable"] is True
    t.meta.pop("gender")
    c = compute_completeness(t)
    assert c["publishable"] is False
    assert c["facets"]["property"] == "partial"
    assert any("gender preference" in i for i in c["open_items"])


def test_offering_requires_deposit_notice_lockin():
    """An otherwise-ready offering missing the P0 terms blocks publish, each with its own item."""
    t = _named_tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1, sharing="single"))[0]
    t.apply(sc.MarkRentable(space_ids=[r.id]))
    off = t.apply(sc.CreateOffering(name="Bare", price=9000))  # priced, but no terms
    t.apply(sc.MapOffering(space_ids=[r.id], offering_id=off.id))

    c = compute_completeness(t)
    assert c["publishable"] is False
    assert c["facets"]["offerings"] == "partial"
    items = c["open_items"]
    assert any("needs a security deposit" in i for i in items)
    assert any("needs a notice period" in i for i in items)
    assert any("needs a lock-in period" in i for i in items)


def test_zero_deposit_and_no_lockin_are_valid_answers():
    """0 is a real answer (zero-deposit PG, no lock-in) — only None blocks. Distinguishes
    'asked, answer is zero' from 'never asked'."""
    t = _named_tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1, sharing="single"))[0]
    t.apply(sc.MarkRentable(space_ids=[r.id]))
    off = t.apply(sc.CreateOffering(
        name="Zero deposit", price=8000,
        attrs={"deposit_months": 0, "notice_days": 15, "lock_in_months": 0},
    ))
    t.apply(sc.MapOffering(space_ids=[r.id], offering_id=off.id))

    c = compute_completeness(t)
    assert c["publishable"] is True
    assert c["facets"]["offerings"] == "complete"


def test_deposit_amount_satisfies_deposit_requirement():
    """A flat deposit figure (deposit_amount) is an acceptable alternative to deposit_months."""
    t = _named_tree()
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    r = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=1, sharing="single"))[0]
    t.apply(sc.MarkRentable(space_ids=[r.id]))
    off = t.apply(sc.CreateOffering(
        name="Flat deposit", price=8000,
        attrs={"deposit_amount": 15000, "notice_days": 30, "lock_in_months": 6},
    ))
    t.apply(sc.MapOffering(space_ids=[r.id], offering_id=off.id))
    assert compute_completeness(t)["publishable"] is True
