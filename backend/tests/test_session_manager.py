"""Tests for tarini/session_manager.py — history caching, persistence on disconnect."""
import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from tarini.session_manager import SessionManager


def _make_manager():
    return SessionManager()


async def _drain(gen):
    """Collect all events from an async generator."""
    events = []
    async for event in gen:
        events.append(event)
    return events


# ---------------------------------------------------------------------------
# History loading
# ---------------------------------------------------------------------------

class TestHistoryLoading:
    async def test_cache_miss_loads_from_db(self):
        mgr = _make_manager()
        history_from_db = [{"role": "user", "content": "hello"}]
        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock(return_value=history_from_db)
            mock_db.save_messages = AsyncMock()

            async def _events(*_a, **_kw):
                yield {"type": "done"}

            mock_stream.side_effect = _events
            await _drain(mgr.chat("sid", "hi"))

        mock_db.load_messages.assert_awaited_once_with("sid")
        assert mgr._histories["sid"] is not None

    async def test_cache_hit_skips_db_load(self):
        mgr = _make_manager()
        mgr._histories["sid"] = [{"role": "user", "content": "cached"}]
        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock()
            mock_db.save_messages = AsyncMock()

            async def _events(*_a, **_kw):
                yield {"type": "done"}

            mock_stream.side_effect = _events
            await _drain(mgr.chat("sid", "hi"))

        mock_db.load_messages.assert_not_awaited()


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

class TestPersistence:
    async def test_persists_after_done_event(self):
        mgr = _make_manager()
        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock(return_value=[])
            mock_db.save_messages = AsyncMock()

            async def _events(*_a, **_kw):
                yield {"type": "text", "text": "hello"}
                yield {"type": "done"}

            mock_stream.side_effect = _events
            await _drain(mgr.chat("sid", "hi"))
            # Persistence is a detached task — await it deterministically.
            await asyncio.gather(*mgr._pending_persists, return_exceptions=True)

        mock_db.save_messages.assert_awaited_once()

    async def test_persists_even_when_cancelled_mid_stream(self):
        """Core regression test: history must be persisted on client disconnect."""
        mgr = _make_manager()
        saved = []

        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock(return_value=[])

            async def _capture_save(session_id, messages):
                saved.append((session_id, messages))

            mock_db.save_messages = AsyncMock(side_effect=_capture_save)

            async def _long_stream(*_a, **_kw):
                yield {"type": "text", "text": "chunk1"}
                await asyncio.sleep(10)  # simulate slow stream
                yield {"type": "done"}   # never reached when cancelled

            mock_stream.side_effect = _long_stream

            async def _run():
                async for _ in mgr.chat("sid", "hi"):
                    pass  # cancelled after first event

            task = asyncio.create_task(_run())
            # Let first chunk arrive, then cancel (simulates client disconnect)
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Allow the detached persist task to run.
        await asyncio.sleep(0)
        # Persistence must have fired despite cancellation
        assert len(saved) == 1, "save_messages must be called even when task is cancelled"

    async def test_pending_persist_is_awaited_by_cleanup_on_shutdown(self):
        """Shutdown race: cancel mid-stream, then cleanup() must finish the write
        before returning (otherwise the DB client closes under a detached task)."""
        mgr = _make_manager()
        save_started = asyncio.Event()
        save_finished = asyncio.Event()

        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock(return_value=[])

            async def _slow_save(session_id, messages):
                save_started.set()
                await asyncio.sleep(0.05)  # simulate DB latency
                save_finished.set()

            mock_db.save_messages = AsyncMock(side_effect=_slow_save)

            async def _long_stream(*_a, **_kw):
                yield {"type": "text", "text": "chunk1"}
                await asyncio.sleep(10)
                yield {"type": "done"}

            mock_stream.side_effect = _long_stream

            async def _run():
                async for _ in mgr.chat("sid", "hi"):
                    pass

            task = asyncio.create_task(_run())
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            # The persist task was spawned but may not be done yet.
            await save_started.wait()
            assert not save_finished.is_set(), "precondition: save still in flight"

            # cleanup() must block until the in-flight persist completes.
            await mgr.cleanup()
            assert save_finished.is_set(), "cleanup must await pending persists before returning"

    async def test_persists_on_error_event(self):
        mgr = _make_manager()
        with patch("tarini.session_manager.db") as mock_db, \
             patch("tarini.session_manager.stream_chat") as mock_stream:
            mock_db.load_messages = AsyncMock(return_value=[])
            mock_db.save_messages = AsyncMock()

            async def _events(*_a, **_kw):
                yield {"type": "error", "message": "upstream failure"}

            mock_stream.side_effect = _events
            await _drain(mgr.chat("sid", "hi"))
            await asyncio.gather(*mgr._pending_persists, return_exceptions=True)

        mock_db.save_messages.assert_awaited_once()


# ---------------------------------------------------------------------------
# remove_session / eviction
# ---------------------------------------------------------------------------

class TestSessionRemoval:
    def test_remove_session_clears_all_state(self):
        mgr = _make_manager()
        mgr._histories["sid"] = []
        mgr._query_locks["sid"] = asyncio.Lock()
        mgr._last_used["sid"] = 1.0
        mgr.remove_session("sid")
        assert "sid" not in mgr._histories
        assert "sid" not in mgr._query_locks
        assert "sid" not in mgr._last_used

    def test_remove_nonexistent_session_is_noop(self):
        mgr = _make_manager()
        mgr.remove_session("nonexistent")  # must not raise
