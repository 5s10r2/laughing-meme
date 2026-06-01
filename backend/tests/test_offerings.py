"""Offerings — curated, fully-structured priced templates (Phase A, slice 3).

Every categorical value is validated against a fixed catalog (enums; amenities/services
multi-select from fixed sets) — NO free text — so listings stay filterable + sane.
Offerings live on the property aggregate and map to rentable Space nodes.
"""
from __future__ import annotations

import pytest

from tarini.domain.errors import InvariantViolation, NotFound
from tarini.domain.space import SpaceTree
from tarini.domain import space_commands as sc


def _seq_gen():
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


def _tree_with_rooms():
    t = SpaceTree.new("Sunrise PG", id_gen=_seq_gen())
    f = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["G"]))[0]
    rooms = t.apply(sc.AddSpaces(parent_id=f.id, kind="room", count=3, sharing="double"))
    return t, [r.id for r in rooms]


# --------------------------------------------------------------------------- create + validate
def test_create_offering_with_structured_attrs():
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(
        name="AC Double", price=9000, billing_basis="per_bed", billing_period="monthly",
        attrs={"sharing": "double", "ac": True, "food": "optional",
               "furnishing": "fully_furnished", "amenities": ["wifi", "geyser"]},
    ))
    assert off.name == "AC Double" and off.price == 9000
    assert off.billing_basis == "per_bed" and off.ac is True
    assert off.amenities == ["wifi", "geyser"] and off.active is True
    assert t.offerings[off.id] is off


def test_create_offering_rejects_unknown_enum_value():
    t, _ = _tree_with_rooms()
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", attrs={"furnishing": "marble"}))      # not an enum
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", billing_basis="per_year"))            # not an enum
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", attrs={"amenities": ["wifi", "jacuzzi"]}))  # not in list


def test_create_offering_rejects_unknown_field():
    t, _ = _tree_with_rooms()
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", attrs={"colour": "blue"}))  # no free-text fields


def test_create_offering_rejects_wrong_type():
    t, _ = _tree_with_rooms()
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", attrs={"ac": "yes"}))            # bool field
    with pytest.raises(InvariantViolation):
        t.apply(sc.CreateOffering(name="X", attrs={"carpet_area_sqft": "big"}))  # int field


def test_food_optional_is_coerced_to_included():
    """'optional' was dropped from the food catalog; legacy/stale values coerce to 'included'
    so existing snapshots keep loading (no migration)."""
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="Tiffin", attrs={"food": "optional"}))
    assert off.food == "included"
    # the two current values still work
    assert t.apply(sc.CreateOffering(name="A", attrs={"food": "included"})).food == "included"
    assert t.apply(sc.CreateOffering(name="B", attrs={"food": "none"})).food == "none"


def test_premium_amenities_in_catalog():
    """Real co-living amenities the live audit caught missing are now accepted."""
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(
        name="Premium", attrs={"amenities": ["parking", "gym", "swimming_pool", "sports_court"]}))
    assert set(off.amenities) == {"parking", "gym", "swimming_pool", "sports_court"}


def test_maintenance_amount_accepted():
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="WithMaint", price=20000, attrs={"maintenance_amount": 2000}))
    assert off.maintenance_amount == 2000


def test_catalog_errors_list_valid_values():
    """The blind-loop fix: a rejection tells the caller what IS valid, so the agent self-corrects
    instead of guessing synonyms."""
    t, _ = _tree_with_rooms()
    with pytest.raises(InvariantViolation) as exc:
        t.apply(sc.CreateOffering(name="X", attrs={"amenities": ["jacuzzi"]}))
    assert "Valid:" in str(exc.value) and "swimming_pool" in str(exc.value)
    with pytest.raises(InvariantViolation) as exc2:
        t.apply(sc.CreateOffering(name="Y", attrs={"furnishing": "marble"}))
    assert "Valid:" in str(exc2.value) and "fully_furnished" in str(exc2.value)


# --------------------------------------------------------------------------- update / disable / delete
def test_update_offering_partial():
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="Std", price=8000))
    t.apply(sc.UpdateOffering(offering_id=off.id, price=8500, attrs={"ac": True}))
    assert t.offerings[off.id].price == 8500 and t.offerings[off.id].ac is True
    assert t.offerings[off.id].name == "Std"  # untouched


def test_disable_offering_keeps_it_inactive():
    t, _ = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="Std", price=8000))
    t.apply(sc.DisableOffering(offering_id=off.id))
    assert t.offerings[off.id].active is False


def test_delete_offering_blocked_while_mapped():
    t, ids = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="Std", price=8000))
    t.apply(sc.MapOffering(space_ids=ids, offering_id=off.id))
    with pytest.raises(InvariantViolation):
        t.apply(sc.DeleteOffering(offering_id=off.id))      # mapped → blocked
    t.apply(sc.UnmapOffering(space_ids=ids))
    t.apply(sc.DeleteOffering(offering_id=off.id))          # now allowed
    assert off.id not in t.offerings


# --------------------------------------------------------------------------- mapping
def test_map_and_unmap_offering():
    t, ids = _tree_with_rooms()
    off = t.apply(sc.CreateOffering(name="AC Double", price=9000))
    t.apply(sc.MapOffering(space_ids=ids, offering_id=off.id))
    assert all(t.get(i).offering_id == off.id for i in ids)
    t.apply(sc.UnmapOffering(space_ids=ids[:1]))
    assert t.get(ids[0]).offering_id is None
    assert t.get(ids[1]).offering_id == off.id


def test_offering_does_not_alias_caller_list():
    t, _ = _tree_with_rooms()
    amenities = ["wifi"]
    off = t.apply(sc.CreateOffering(name="X", price=1, attrs={"amenities": amenities}))
    amenities.append("gym")  # mutate the caller's list afterwards
    assert off.amenities == ["wifi"]  # aggregate kept its own copy
    mine = ["geyser"]
    t.apply(sc.UpdateOffering(offering_id=off.id, attrs={"amenities": mine}))
    mine.append("parking")
    assert t.offerings[off.id].amenities == ["geyser"]


def test_map_rejects_unknown_offering_or_space():
    t, ids = _tree_with_rooms()
    with pytest.raises(NotFound):
        t.apply(sc.MapOffering(space_ids=ids, offering_id="ghost"))
    off = t.apply(sc.CreateOffering(name="X", price=1))
    with pytest.raises(NotFound):
        t.apply(sc.MapOffering(space_ids=["ghost"], offering_id=off.id))
