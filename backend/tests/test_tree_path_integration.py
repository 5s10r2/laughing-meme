"""Live integration of the tree path through the real server routes (Phase D verification).

Drives /sessions, /sessions/:id/commands, /sessions/:id/model with USE_TREE_MODEL=1 — the
direct (no-LLM) Blueprint path — and asserts a flat-building is built, persisted, and
projected as FLATS (not rooms). Proves the flag-gated wiring end to end.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def tree_client(monkeypatch):
    monkeypatch.setenv("USE_TREE_MODEL", "1")
    monkeypatch.setenv("USE_NEW_EXPERIENCE", "1")
    monkeypatch.setenv("ALLOW_IN_MEMORY_DB", "1")
    monkeypatch.delenv("TARINI_API_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    import tarini.agent as agent
    agent._tree_command_service = None  # fresh in-memory tree store per test
    import server
    with TestClient(server.app) as client:  # context-manager runs the lifespan (init_client)
        yield client


def _apply(client, sid, commands, version=None):
    body = {"commands": commands}
    if version is not None:
        body["expected_version"] = version
    r = client.post(f"/sessions/{sid}/commands", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_direct_path_builds_and_projects_a_flat_building(tree_client):
    sid = tree_client.post("/sessions").json()["session_id"]

    model = tree_client.get(f"/sessions/{sid}/model").json()["model"]
    root_id = model["root_id"]

    snap = _apply(tree_client, sid, [
        {"op": "SetProperty", "name": "Great Heights", "type": "flat", "location": "Gurgaon"},
        {"op": "AddSpaces", "parent_id": root_id, "kind": "floor", "labels": ["Ground"]},
    ])
    floor_id = [s for s in snap["model"]["spaces"] if s["kind"] == "floor"][0]["id"]

    snap = _apply(tree_client, sid, [
        {"op": "AddSpaces", "parent_id": floor_id, "kind": "flat",
         "labels": ["G1", "G2"], "config": "2bhk"},
    ], version=snap["version"])
    flat_ids = [s["id"] for s in snap["model"]["spaces"] if s["kind"] == "flat"]

    snap = _apply(tree_client, sid, [
        {"op": "MarkRentable", "space_ids": flat_ids},
        {"op": "CreateOffering", "name": "2BHK Furnished", "price": 25000,
         "billing_basis": "per_unit", "attrs": {"config": "2bhk"}},
    ], version=snap["version"])
    off_id = snap["model"]["offerings"][0]["id"]

    snap = _apply(tree_client, sid, [
        {"op": "MapOffering", "space_ids": flat_ids[:1], "offering_id": off_id},
    ], version=snap["version"])

    # persisted + projected through the REAL /model route
    body = tree_client.get(f"/sessions/{sid}/model").json()
    assert body["model"]["meta"]["name"] == "Great Heights"
    bp = body["blueprint"]
    # flat-building renders as FLATS, not rooms
    assert "Flats" in {s["label"] for s in bp["MassingModel"]["stats"]}
    # mapping: G1 mapped, G2 not
    units = {u["name"]: u for f in bp["BlueprintMapping"]["floors"] for u in f["units"]}
    assert units["G1"]["packageId"] == off_id and units["G2"]["packageId"] is None
    assert units["G1"]["category"] == "2bhk"
    # unmapped warning lists G2
    assert any(u["name"] == "G2" for f in bp["UnmappedWarning"]["floors"] for u in f["units"])
    # package panel reflects the offering
    pk = bp["PackagePanel"]["packages"][0]
    assert pk["name"] == "2BHK Furnished" and pk["rent"] == 25000 and pk["roomCount"] == 1


def test_bad_command_is_clean_400_not_500(tree_client):
    sid = tree_client.post("/sessions").json()["session_id"]
    r = tree_client.post(f"/sessions/{sid}/commands", json={"commands": [{"op": "Nope"}]})
    assert r.status_code == 400
    # wrong value type also a clean 400 (codec boundary holds for the tree vocab too)
    r = tree_client.post(f"/sessions/{sid}/commands",
                         json={"commands": [{"op": "AddSpaces", "parent_id": "x",
                                             "kind": "room", "count": "two"}]})
    assert r.status_code == 400


def test_unknown_space_is_422(tree_client):
    sid = tree_client.post("/sessions").json()["session_id"]
    r = tree_client.post(f"/sessions/{sid}/commands",
                         json={"commands": [{"op": "RenameSpace", "space_id": "ghost", "label": "X"}]})
    assert r.status_code == 422
