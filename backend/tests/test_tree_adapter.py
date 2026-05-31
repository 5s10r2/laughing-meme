"""Tree projections (heterogeneity Phase A2).

Projects a SpaceTree into the SAME blueprint component props the live frontend already
consumes (massing / floor_ledger / mapping / unmapped / package_panel) — so the frontend
renders the new model unchanged. Generic over the tree: a unit's "category" is its
sharing (rooms) / config (flats) / kind (beds); a floor's units are the rentable nodes in
its subtree. Verified for both a migrated PG and a flat-building. Pure presentation.
"""
from __future__ import annotations

from tarini.domain.space import SpaceTree
from tarini.domain import space_commands as sc
from tarini import tree_adapter as ta


def _seq_gen():
    n = 0

    def gen(prefix: str) -> str:
        nonlocal n
        n += 1
        return f"{prefix}_{n}"

    return gen


def _pg():
    """A migrated single-block PG: Ground[001 double→AC Double, 002 triple unmapped], First[101]."""
    return SpaceTree.from_legacy(
        {
            "name": "Sunrise PG", "owner_name": "Ravi", "type": "pg",
            "location": "HSR, Bangalore", "gender": "male",
            "blocks": [{"id": "blk1", "label": "Main"}],
            "floors": [
                {"id": "fl1", "block_id": "blk1", "index": 0, "label": "Ground", "active": True},
                {"id": "fl2", "block_id": "blk1", "index": 1, "label": "First", "active": True},
            ],
            "rooms": [
                {"id": "r1", "floor_id": "fl1", "name": "001", "sharing": "double",
                 "package_id": "pk1", "status": "active"},
                {"id": "r2", "floor_id": "fl1", "name": "002", "sharing": "triple",
                 "package_id": None, "status": "active"},
                {"id": "r3", "floor_id": "fl2", "name": "101", "sharing": "double",
                 "package_id": "pk1", "status": "active"},
            ],
            "packages": [
                {"id": "pk1", "name": "AC Double", "sharing": "double", "ac": True,
                 "food": "included", "furnishing": "fully_furnished", "rent": 9000,
                 "amenities": ["wifi"], "active": True},
            ],
        },
        id_gen=_seq_gen(),
    )


def _flats():
    """A flat-building: Ground[G1 2bhk→offering, G2 2bhk unmapped]."""
    t = SpaceTree.new("Great Heights", id_gen=_seq_gen())
    t.meta = {"name": "Great Heights", "type": "flat", "location": "Gurgaon"}
    g = t.apply(sc.AddSpaces(parent_id=t.root().id, kind="floor", labels=["Ground"]))[0]
    flats = t.apply(sc.AddSpaces(parent_id=g.id, kind="flat", labels=["G1", "G2"], config="2bhk"))
    ids = [f.id for f in flats]
    t.apply(sc.MarkRentable(space_ids=ids))
    off = t.apply(sc.CreateOffering(name="2BHK Furnished", price=25000, billing_basis="per_unit",
                                    attrs={"config": "2bhk", "furnishing": "fully_furnished"}))
    t.apply(sc.MapOffering(space_ids=ids[:1], offering_id=off.id))
    return t, ids, off


# --------------------------------------------------------------------------- massing
def test_massing_pg():
    p = ta.massing_props(_pg())
    assert p["propertyName"] == "Sunrise PG" and p["owner"] == "Ravi"
    assert p["meta"] == "Men's PG · HSR, Bangalore"
    assert p["blocks"] == [{"label": "Main", "floors": 2, "accentTop": True}]
    stats = {s["label"]: s["value"] for s in p["stats"]}
    assert stats == {"Floors": 2, "Rooms": 3, "Types": 2}  # double + triple


def test_massing_flats_uses_unit_vocab():
    t, _, _ = _flats()
    p = ta.massing_props(t)
    assert p["meta"] == "Flat · Gurgaon"
    stats = {s["label"]: s["value"] for s in p["stats"]}
    assert stats == {"Floors": 1, "Flats": 2, "Types": 1}  # rentable kind is flat → "Flats"


# --------------------------------------------------------------------------- ledger
def test_floor_ledger_pg_top_down_with_mix():
    out = ta.floor_ledger_props(_pg())["floors"]
    assert [f["name"] for f in out] == ["First", "Ground"]  # top-down
    ground = [f for f in out if f["name"] == "Ground"][0]
    assert ground["rooms"] == 2
    assert sorted(s["key"] for s in ground["segments"]) == ["double", "triple"]
    assert ground["nameRange"] == "001–002"
    assert ground["mapped"] is False  # 002 unmapped
    first = [f for f in out if f["name"] == "First"][0]
    assert first["mapped"] is True


# --------------------------------------------------------------------------- mapping
def test_mapping_pg():
    p = ta.mapping_props(_pg())
    assert [pk["name"] for pk in p["packages"]] == ["AC Double"]
    ground = [f for f in p["floors"] if f["floorLabel"] == "Ground"][0]
    byname = {u["name"]: u for u in ground["units"]}
    assert byname["001"]["packageId"] is not None
    assert byname["002"]["packageId"] is None
    assert byname["001"]["category"] == "double"


def test_mapping_flats():
    t, ids, off = _flats()
    p = ta.mapping_props(t)
    ground = p["floors"][0]
    byname = {u["name"]: u for u in ground["units"]}
    assert byname["G1"]["packageId"] == off.id and byname["G2"]["packageId"] is None
    assert byname["G1"]["category"] == "2bhk"


# --------------------------------------------------------------------------- unmapped
def test_unmapped_pg():
    out = ta.unmapped_props(_pg())["floors"]
    ground = [f for f in out if f["floorLabel"] == "Ground"][0]
    assert [u["name"] for u in ground["units"]] == ["002"]
    assert all(f["floorLabel"] != "First" for f in out)  # First is fully mapped


def test_unmapped_treats_inactive_offering_as_unmapped():
    t, ids, off = _flats()
    t.apply(sc.DisableOffering(offering_id=off.id))  # the only mapping now points at a dead offering
    out = ta.unmapped_props(t)["floors"]
    names = {u["name"] for f in out for u in f["units"]}
    assert names == {"G1", "G2"}  # G1's offering is inactive → reads unmapped


# --------------------------------------------------------------------------- package panel
def test_type_label_humanizes_unknown_underscored_type():
    from tarini.ui_adapter import _type_label
    assert _type_label("apartment_building") == "Apartment Building"  # not "Apartment_Building"
    assert _type_label("pg") == "PG"  # known catalog value unchanged


def test_unit_noun_adapts_to_rentable_kind():
    # PG (rooms) → "room"; flat-building (flats) → "flat" — across every projection
    pg = _pg()
    assert ta.massing_props(pg)["unitNoun"] == "room"
    assert ta.floor_ledger_props(pg)["unitNoun"] == "room"
    assert ta.mapping_props(pg)["unitNoun"] == "room"
    assert ta.unmapped_props(pg)["unitNoun"] == "room"
    assert ta.package_panel_props(pg)["unitNoun"] == "room"
    t, _, _ = _flats()
    assert ta.massing_props(t)["unitNoun"] == "flat"
    assert ta.floor_ledger_props(t)["unitNoun"] == "flat"
    assert ta.package_panel_props(t)["unitNoun"] == "flat"


def test_blueprint_registry_projects_from_model_dict():
    model = _pg().to_dict()
    massing = ta.tree_blueprint_props("MassingModel", model)
    assert {s["label"]: s["value"] for s in massing["stats"]}["Rooms"] == 3
    assert ta.tree_blueprint_props("QuickReplyChips", model) is None  # not a blueprint component
    assert ta.is_blueprint_component("FloorLedger") is True


def test_session_snapshot_shape_and_stage():
    t, ids, off = _flats()
    snap = {"model": t.to_dict(),
            "completeness": __import__("tarini.domain.space_completeness",
                                       fromlist=["compute_completeness"]).compute_completeness(t),
            "version": 4}
    out = ta.tree_session_snapshot(snap)
    assert out["stateVersion"] == 4
    assert out["state"]["property_name"] == "Great Heights"
    assert out["state"]["property_type"] == "flat"
    assert {u["name"] for u in out["state"]["units"]} == {"G1", "G2"}
    # G2 unmapped → mapping not complete → stage stalls before verification
    assert out["stage"] == "mapping"


def test_derive_stage_uses_offerings_facet():
    assert ta.tree_derive_stage({"property": "complete", "structure": "complete",
                                 "offerings": "partial", "mapping": "empty"}) == "packages"
    assert ta.tree_derive_stage({"property": "complete", "structure": "complete",
                                 "offerings": "complete", "mapping": "complete"}) == "verification"


def test_live_context_reads_meta_and_tree_counts():
    snap = {"model": _pg().to_dict(),
            "completeness": __import__("tarini.domain.space_completeness",
                                       fromlist=["compute_completeness"]).compute_completeness(_pg())}
    text = ta.tree_live_context(snap)
    assert "Sunrise PG" in text and "units" in text and "offerings" in text


def test_package_panel_pg():
    p = ta.package_panel_props(_pg())["packages"]
    assert len(p) == 1
    pk = p[0]
    assert pk["name"] == "AC Double" and pk["rent"] == 9000 and pk["ac"] is True
    assert pk["food"] == "included" and pk["furnishing"] == "fully_furnished"
    assert pk["amenities"] == ["wifi"]
    assert pk["roomCount"] == 2  # 001 + 101 mapped to it
