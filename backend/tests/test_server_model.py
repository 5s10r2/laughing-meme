"""GET /sessions/{id}/model — the live read-model endpoint backing the Blueprint.

The Blueprint reads the property model straight from CommandService (no LLM), so the
UI is a projection of the single source of truth. These cover the route wiring and
contract; the projection content itself is covered by the command_service/ui_adapter tests.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    # Force the in-memory store so the route works without Supabase.
    monkeypatch.setenv("ALLOW_IN_MEMORY_DB", "true")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    import server
    with TestClient(server.app) as c:
        yield c


def test_get_model_fresh_session_returns_empty_model(client):
    sid = client.post("/sessions").json()["session_id"]
    r = client.get(f"/sessions/{sid}/model")
    assert r.status_code == 200
    body = r.json()
    # the snapshot shape the Blueprint consumes
    assert {"model", "completeness", "version"} <= set(body)
    assert body["version"] == 0
    assert body["completeness"].get("publishable") is False


def test_get_model_unknown_session_is_404(client):
    r = client.get("/sessions/does-not-exist/model")
    assert r.status_code == 404
