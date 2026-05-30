"""Tests for tarini/tools/state.py — get_state, update_state, advance_stage."""
import json
from unittest.mock import AsyncMock, patch
import pytest

from tarini.tools.state import get_state, update_state, advance_stage, VALID_STAGES


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_session(stage="intro", state=None, state_version=1):
    return {
        "id": "test-session-id",
        "stage": stage,
        "state": state or {},
        "state_version": state_version,
    }


# ---------------------------------------------------------------------------
# get_state
# ---------------------------------------------------------------------------

class TestGetState:
    async def test_returns_session_state(self):
        session = _make_session(stage="structure", state={"property_name": "Green PG"})
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=session)
            result = json.loads(await get_state("sid"))
        assert result["stage"] == "structure"
        assert result["state"]["property_name"] == "Green PG"
        assert result["state_version"] == 1

    async def test_session_not_found_returns_error(self):
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=None)
            result = json.loads(await get_state("missing"))
        assert "error" in result

    async def test_null_state_defaults_to_empty_dict(self):
        session = _make_session(state=None)
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=session)
            result = json.loads(await get_state("sid"))
        assert result["state"] == {}


# ---------------------------------------------------------------------------
# update_state
# ---------------------------------------------------------------------------

class TestUpdateState:
    async def test_saves_valid_updates(self):
        session = _make_session(stage="intro", state={})
        updated = {"state": {"property_name": "Test PG"}, "state_version": 2}
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=session)
            mock_db.update_session_state = AsyncMock(return_value=updated)
            result = json.loads(await update_state("sid", {"property_name": "Test PG"}))
        assert result["saved"] is True
        assert result["stage"] == "intro"
        assert result["state_version"] == 2

    async def test_empty_updates_returns_error(self):
        result = json.loads(await update_state("sid", {}))
        assert "error" in result

    async def test_session_not_found_returns_error(self):
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=None)
            result = json.loads(await update_state("sid", {"property_name": "X"}))
        assert "error" in result

    async def test_invalid_state_returns_schema_error(self):
        session = _make_session()
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=session)
            result = json.loads(await update_state("sid", {"property_type": "castle"}))
        assert result.get("code") == "STATE_SCHEMA_INVALID"

    async def test_deep_merges_nested_state(self):
        """Existing state keys not in updates must be preserved."""
        existing = {"property_name": "Green PG", "property_type": "pg"}
        session = _make_session(state=existing)
        updated = {"state": {**existing, "property_location": "Pune"}, "state_version": 2}
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.get_session = AsyncMock(return_value=session)
            mock_db.update_session_state = AsyncMock(return_value=updated)
            result = json.loads(await update_state("sid", {"property_location": "Pune"}))
        assert result["saved"] is True
        # update_session_state was called with merged state
        call_args = mock_db.update_session_state.call_args[0]
        assert call_args[1]["property_name"] == "Green PG"
        assert call_args[1]["property_location"] == "Pune"


# ---------------------------------------------------------------------------
# advance_stage
# ---------------------------------------------------------------------------

class TestAdvanceStage:
    async def test_advances_to_valid_stage(self):
        db_row = {"stage": "structure", "state": {}, "state_version": 1}
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.advance_stage = AsyncMock(return_value=db_row)
            result = json.loads(await advance_stage("sid", "structure"))
        assert result["advanced"] is True
        assert result["stage"] == "structure"
        assert "state" in result
        assert "state_version" in result

    async def test_invalid_stage_returns_error(self):
        result = json.loads(await advance_stage("sid", "nonexistent"))
        assert "error" in result

    async def test_stage_is_normalised(self):
        """Whitespace and case should be stripped before validation."""
        result = json.loads(await advance_stage("sid", "  INVALID  "))
        assert "error" in result

    @pytest.mark.parametrize("stage", VALID_STAGES)
    async def test_all_valid_stages_accepted(self, stage):
        db_row = {"stage": stage, "state": {}, "state_version": 1}
        with patch("tarini.tools.state.db") as mock_db:
            mock_db.advance_stage = AsyncMock(return_value=db_row)
            result = json.loads(await advance_stage("sid", stage))
        assert result["advanced"] is True
