"""Funnel derivation from stored snapshots — stage classification + cumulative aggregation."""
from __future__ import annotations

from tarini.funnel_stats import compute_funnel, stage_of


def _tree(*, name=None, units=0, rentable=True, offerings=0, mapped=0, published=False) -> dict:
    spaces = [{"id": "p", "kind": "property", "rentable": False}]
    for i in range(units):
        spaces.append({
            "id": f"r{i}", "kind": "room", "rentable": rentable,
            "offering_id": "o0" if i < mapped else None,
        })
    return {
        "spaces": spaces,
        "offerings": [{"id": f"o{j}"} for j in range(offerings)],
        "meta": {**({"name": name} if name else {}), **({"published": True} if published else {})},
    }


def test_stage_of_tree_progression():
    assert stage_of(_tree()) == "started"
    assert stage_of(_tree(name="X")) == "named"
    assert stage_of(_tree(name="X", units=2)) == "units"
    assert stage_of(_tree(name="X", units=2, offerings=1)) == "offerings"
    assert stage_of(_tree(name="X", units=2, offerings=1, mapped=2)) == "mapped"
    assert stage_of(_tree(name="X", units=2, offerings=1, mapped=2, published=True)) == "published"


def test_stage_of_legacy():
    assert stage_of({"name": "Old", "rooms": [{"id": "r", "package_id": "p"}], "packages": [{"id": "p"}]}) == "mapped"
    assert stage_of({"name": "Old"}) == "named"
    assert stage_of({}) == "started"


def test_cumulative_funnel():
    snaps = [
        _tree(),                                                   # started (engaged, nothing)
        _tree(name="A"),                                           # named
        _tree(name="B", units=3),                                  # units
        _tree(name="C", units=4, offerings=2, mapped=4, published=True),  # published
    ]
    f = compute_funnel(snaps, sessions_total=6)  # 2 sessions never engaged
    by = {s["key"]: s["count"] for s in f["stages"]}
    assert by["started"] == 6
    assert by["named"] == 3        # A, B, C
    assert by["units"] == 2        # B, C
    assert by["offerings"] == 1    # C
    assert by["mapped"] == 1       # C
    assert by["published"] == 1    # C
    assert f["engaged"] == 4 and f["published"] == 1
    # drop-off + pct sane
    started_stage = f["stages"][0]
    assert started_stage["pctOfStarted"] == 100
    assert f["stages"][1]["dropFromPrev"] == 3  # 6 started → 3 named


def test_empty_is_safe():
    f = compute_funnel([], sessions_total=0)
    assert f["sessionsTotal"] == 0 and f["published"] == 0
    assert all(s["count"] == 0 for s in f["stages"])
