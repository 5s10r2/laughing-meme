"""POST /sessions/{id}/commands — direct model edits from the Blueprint (no LLM).

The panel mutates the single source of truth through the same CommandService the
agent uses, with expected_version for optimistic concurrency. These cover the route
wiring, the snapshot+blueprint return shape, and the error contract; command
semantics themselves are covered by the command_service/domain tests.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ALLOW_IN_MEMORY_DB", "true")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    import server
    with TestClient(server.app) as c:
        yield c


def _new(client) -> str:
    return client.post("/sessions").json()["session_id"]


def test_apply_commands_mutates_and_returns_snapshot_with_blueprint(client):
    sid = _new(client)
    r = client.post(f"/sessions/{sid}/commands", json={"commands": [
        {"op": "SetProperty", "name": "Sunrise PG", "type": "pg", "location": "HSR"},
        {"op": "AddFloors", "count": 2, "start_index": 1},
    ]})
    assert r.status_code == 200
    body = r.json()
    assert body["model"]["name"] == "Sunrise PG"
    assert body["version"] >= 1
    # same projection block the panel renders, so it can update in place
    assert body["blueprint"]["MassingModel"]["propertyName"] == "Sunrise PG"
    assert {s["label"]: s["value"] for s in body["blueprint"]["MassingModel"]["stats"]}["Floors"] == 2


def test_apply_commands_unknown_session_is_404(client):
    r = client.post("/sessions/nope/commands", json={"commands": [{"op": "AddFloors", "count": 1}]})
    assert r.status_code == 404


def test_apply_commands_rejects_bad_command_400(client):
    sid = _new(client)
    r = client.post(f"/sessions/{sid}/commands", json={"commands": [{"op": "NotARealCommand"}]})
    assert r.status_code == 400


def test_apply_commands_wrong_field_type_is_400_not_500(client):
    # raw client input with a valid field name but wrong value type must be a clean 400,
    # never a leaked 500 (the endpoint accepts untrusted command objects from the browser).
    sid = _new(client)
    r = client.post(f"/sessions/{sid}/commands", json={"commands": [{"op": "AddFloors", "count": "two"}]})
    assert r.status_code == 400


def test_apply_commands_version_conflict_409(client):
    sid = _new(client)
    client.post(f"/sessions/{sid}/commands", json={"commands": [{"op": "AddFloors", "count": 1}]})
    # stale expected_version → optimistic-concurrency conflict
    r = client.post(f"/sessions/{sid}/commands", json={
        "commands": [{"op": "AddFloors", "count": 1}],
        "expected_version": 0,
    })
    assert r.status_code == 409
