"""Tests for tarini/db/client.py — in-memory store operations and guards."""
import os
import pytest

# Force in-memory mode for all tests — no Supabase required.
os.environ["ALLOW_IN_MEMORY_DB"] = "true"
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "")

import tarini.db.client as db


@pytest.fixture(autouse=True)
async def reset_memory():
    """Clear in-memory state and force memory mode before each test."""
    db._mem_sessions.clear()
    db._USE_MEMORY = True
    yield
    db._mem_sessions.clear()


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------

class TestCreateSession:
    async def test_creates_session_with_defaults(self):
        session = await db.create_session()
        assert "id" in session
        assert session["stage"] == "intro"
        assert session["state"] == {}

    async def test_stores_session_in_memory(self):
        session = await db.create_session()
        assert session["id"] in db._mem_sessions

    async def test_two_sessions_have_different_ids(self):
        s1 = await db.create_session()
        s2 = await db.create_session()
        assert s1["id"] != s2["id"]


# ---------------------------------------------------------------------------
# get_session
# ---------------------------------------------------------------------------

class TestGetSession:
    async def test_returns_none_for_unknown_id(self):
        result = await db.get_session("does-not-exist")
        assert result is None

    async def test_returns_session_after_create(self):
        session = await db.create_session()
        found = await db.get_session(session["id"])
        assert found is not None
        assert found["id"] == session["id"]


# ---------------------------------------------------------------------------
# update_session_state
# ---------------------------------------------------------------------------

class TestUpdateSessionState:
    async def test_updates_state_and_increments_version(self):
        session = await db.create_session()
        result = await db.update_session_state(session["id"], {"property_name": "Green PG"})
        assert result["state"]["property_name"] == "Green PG"
        assert result["state_version"] == 1

    async def test_version_increments_on_each_update(self):
        session = await db.create_session()
        sid = session["id"]
        r1 = await db.update_session_state(sid, {"property_name": "A"})
        r2 = await db.update_session_state(sid, {"property_name": "B"})
        assert r2["state_version"] == r1["state_version"] + 1

    async def test_raises_for_unknown_session(self):
        with pytest.raises(ValueError, match="not found"):
            await db.update_session_state("ghost-id", {"x": 1})


# ---------------------------------------------------------------------------
# advance_stage
# ---------------------------------------------------------------------------

class TestAdvanceStage:
    async def test_advances_stage(self):
        session = await db.create_session()
        result = await db.advance_stage(session["id"], "structure")
        assert result["stage"] == "structure"

    async def test_raises_for_unknown_session(self):
        with pytest.raises(ValueError, match="not found"):
            await db.advance_stage("ghost-id", "structure")


# ---------------------------------------------------------------------------
# save_messages / load_messages
# ---------------------------------------------------------------------------

class TestMessages:
    async def test_round_trip(self):
        session = await db.create_session()
        sid = session["id"]
        messages = [{"role": "user", "content": "hello"}]
        await db.save_messages(sid, messages)
        loaded = await db.load_messages(sid)
        assert loaded == messages

    async def test_load_returns_empty_for_new_session(self):
        session = await db.create_session()
        loaded = await db.load_messages(session["id"])
        assert loaded == []

    async def test_save_to_unknown_session_is_noop(self):
        """save_messages on a non-existent in-memory session should not raise."""
        await db.save_messages("ghost-id", [{"role": "user", "content": "x"}])
