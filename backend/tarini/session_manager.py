"""
Per-session ClaudeSDKClient lifecycle manager.

Guarantees:
  • One ClaudeSDKClient per session (created lazily, on first request).
  • One asyncio.Lock per session for connection setup (prevents double-init).
  • One asyncio.Lock per session for query serialisation (prevents concurrent queries).
  • Idle sessions are evicted after _IDLE_TTL_SECONDS (default 30 min).
  • All four supporting dicts are pruned together on remove/cleanup — no leak.

Thread safety:
  _connect_lock serialises concurrent connect() calls for the same session.
  query_lock serialises query()+receive_response() pairs — one at a time per session.
"""
import asyncio
import logging
import time

from claude_agent_sdk import ClaudeSDKClient

from tarini.agent import build_options
from tarini.db import client as db

logger = logging.getLogger(__name__)

_IDLE_TTL_SECONDS = 30 * 60        # evict after 30 minutes of inactivity
_EVICTION_INTERVAL_SECONDS = 5 * 60  # check every 5 minutes


class SessionManager:
    def __init__(self) -> None:
        # session_id → connected ClaudeSDKClient
        self._clients: dict[str, ClaudeSDKClient] = {}
        # Locks to prevent concurrent connect() for the same session
        self._connect_locks: dict[str, asyncio.Lock] = {}
        # Locks to serialise query+receive pairs (one at a time per session)
        self._query_locks: dict[str, asyncio.Lock] = {}
        # Last-used monotonic timestamp per session (for idle eviction)
        self._last_used: dict[str, float] = {}
        # Background eviction task handle
        self._eviction_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start_eviction_task(self) -> None:
        """Start the background idle-eviction loop. Call once at app startup."""
        self._eviction_task = asyncio.create_task(self._evict_idle_sessions())
        logger.info(
            "Session eviction task started (TTL=%ds, interval=%ds)",
            _IDLE_TTL_SECONDS,
            _EVICTION_INTERVAL_SECONDS,
        )

    async def get_or_create_client(self, session_id: str) -> ClaudeSDKClient:
        """Return the active ClaudeSDKClient for this session, creating it if needed.

        Safe to call concurrently — the connect lock ensures only one connect() per session.
        Touches _last_used on every call so idle TTL resets on activity.
        """
        async with self._connect_lock(session_id):
            if session_id in self._clients:
                self._last_used[session_id] = time.monotonic()
                return self._clients[session_id]

            session = await db.get_session(session_id)
            sdk_session_id = (session.get("sdk_session_id") or None) if session else None

            logger.info(
                "Creating ClaudeSDKClient for session %s (resume=%s)",
                session_id,
                sdk_session_id,
            )

            client = ClaudeSDKClient(
                options=build_options(
                    session_id=session_id,
                    sdk_session_id=sdk_session_id,
                )
            )
            await client.connect()

            self._clients[session_id] = client
            self._last_used[session_id] = time.monotonic()
            return client

    def query_lock(self, session_id: str) -> asyncio.Lock:
        """Return the per-session query lock for use as an async context manager."""
        return self._query_lock(session_id)

    async def remove_client(self, session_id: str) -> None:
        """Disconnect and remove ALL state for a session.

        Pops from all four dicts so no orphaned locks or timestamps accumulate.
        """
        client = self._clients.pop(session_id, None)
        self._connect_locks.pop(session_id, None)
        self._query_locks.pop(session_id, None)
        self._last_used.pop(session_id, None)
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass
        logger.info("Removed client for session %s", session_id)

    async def cleanup(self) -> None:
        """Cancel eviction task and disconnect all active clients — called on shutdown."""
        if self._eviction_task is not None:
            self._eviction_task.cancel()
            try:
                await self._eviction_task
            except asyncio.CancelledError:
                pass
            self._eviction_task = None

        for session_id, client in list(self._clients.items()):
            try:
                await client.disconnect()
            except Exception as exc:
                logger.warning("Error disconnecting session %s: %s", session_id, exc)
            logger.info("Disconnected client for session %s on shutdown", session_id)

        self._clients.clear()
        self._connect_locks.clear()
        self._query_locks.clear()
        self._last_used.clear()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _connect_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._connect_locks:
            self._connect_locks[session_id] = asyncio.Lock()
        return self._connect_locks[session_id]

    def _query_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._query_locks:
            self._query_locks[session_id] = asyncio.Lock()
        return self._query_locks[session_id]

    async def _evict_idle_sessions(self) -> None:
        """Background loop: evict sessions that have been idle longer than TTL."""
        while True:
            await asyncio.sleep(_EVICTION_INTERVAL_SECONDS)
            now = time.monotonic()
            idle = [
                sid
                for sid, last in list(self._last_used.items())
                if (now - last) >= _IDLE_TTL_SECONDS
            ]
            for session_id in idle:
                logger.info(
                    "Evicting idle session %s (idle >%ds)", session_id, _IDLE_TTL_SECONDS
                )
                await self.remove_client(session_id)


# Module-level singleton — imported by server.py
session_manager = SessionManager()
