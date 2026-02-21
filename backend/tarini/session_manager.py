"""
Per-session conversation history manager.

Manages in-memory message history for each session, backed by Supabase persistence.
On cache miss (e.g. after Render free-tier spin-down) the history is reloaded from
the database so conversations survive server restarts.

Guarantees:
  • One message history list per session (created lazily or loaded from DB).
  • One asyncio.Lock per session for query serialisation.
  • History is persisted to Supabase after every turn.
  • Idle sessions are evicted after _IDLE_TTL_SECONDS (default 30 min).
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from tarini.agent import stream_chat
from tarini.db import client as db

logger = logging.getLogger(__name__)

_IDLE_TTL_SECONDS = 30 * 60
_EVICTION_INTERVAL_SECONDS = 5 * 60


class SessionManager:
    def __init__(self) -> None:
        # session_id → list of conversation messages
        self._histories: dict[str, list[dict]] = {}
        # Locks to serialise queries (one at a time per session)
        self._query_locks: dict[str, asyncio.Lock] = {}
        # Last-used timestamps for idle eviction
        self._last_used: dict[str, float] = {}
        # Background eviction task
        self._eviction_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start_eviction_task(self) -> None:
        self._eviction_task = asyncio.create_task(self._evict_idle_sessions())
        logger.info(
            "Session eviction task started (TTL=%ds, interval=%ds)",
            _IDLE_TTL_SECONDS, _EVICTION_INTERVAL_SECONDS,
        )

    @asynccontextmanager
    async def query_lock(self, session_id: str) -> AsyncIterator[None]:
        """Acquire the per-session lock for query serialisation."""
        lock = self._query_locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            yield

    async def chat(
        self, session_id: str, user_message: str,
    ) -> AsyncIterator[dict]:
        """
        Send a message and stream SSE events. Manages history automatically.
        Must be called inside a query_lock context.

        On cache miss (server restarted / session evicted) the history is
        loaded from Supabase so the conversation picks up where it left off.
        After the turn completes the updated history is persisted back.
        """
        # Load from DB on cache miss
        if session_id not in self._histories:
            logger.info("Cache miss for session %s — loading history from DB", session_id)
            self._histories[session_id] = await db.load_messages(session_id)

        history = self._histories[session_id]
        self._last_used[session_id] = time.monotonic()

        async for event in stream_chat(session_id, user_message, history):
            yield event

        # Persist updated history to Supabase after the turn
        self._last_used[session_id] = time.monotonic()
        try:
            await db.save_messages(session_id, history)
            logger.info("Persisted %d messages for session %s", len(history), session_id)
        except Exception:
            logger.exception("Failed to persist messages for session %s", session_id)

    def remove_session(self, session_id: str) -> None:
        """Remove all state for a session."""
        self._histories.pop(session_id, None)
        self._query_locks.pop(session_id, None)
        self._last_used.pop(session_id, None)
        logger.info("Removed session %s", session_id)

    async def cleanup(self) -> None:
        """Cancel eviction task and clear all sessions — called on shutdown."""
        if self._eviction_task is not None:
            self._eviction_task.cancel()
            try:
                await self._eviction_task
            except asyncio.CancelledError:
                pass
            self._eviction_task = None

        self._histories.clear()
        self._query_locks.clear()
        self._last_used.clear()

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    async def _evict_idle_sessions(self) -> None:
        while True:
            await asyncio.sleep(_EVICTION_INTERVAL_SECONDS)
            now = time.monotonic()
            idle = [
                sid for sid, last in list(self._last_used.items())
                if (now - last) >= _IDLE_TTL_SECONDS
            ]
            for session_id in idle:
                logger.info("Evicting idle session %s", session_id)
                self.remove_session(session_id)


# Module-level singleton
session_manager = SessionManager()
