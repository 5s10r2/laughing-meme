"""
Supabase client singleton + session helpers.

Falls back to a pure in-memory store when Supabase is unreachable,
so local development works without network access.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory fallback store
# ---------------------------------------------------------------------------

_USE_MEMORY = False
_mem_sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Supabase client (optional)
# ---------------------------------------------------------------------------

_client = None


async def init_client() -> None:
    global _client, _USE_MEMORY
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using in-memory store")
        _USE_MEMORY = True
        return

    try:
        from supabase import acreate_client
        _client = await asyncio.wait_for(acreate_client(url, key), timeout=5.0)
        # Quick connectivity check
        await asyncio.wait_for(
            _client.table("sessions").select("id").limit(1).execute(),
            timeout=5.0,
        )
        logger.info("Supabase connected OK")
    except Exception as e:
        logger.warning("Supabase unreachable (%s) — falling back to in-memory store", e)
        _client = None
        _USE_MEMORY = True


async def close_client() -> None:
    global _client
    _client = None


_HEALTH_CACHE: dict | None = None
_HEALTH_CACHE_AT = 0.0
_HEALTH_TTL = 30.0  # seconds — platform health probes fire every ~10-30s


async def health_check() -> dict:
    """Cached connectivity check. Returns {"ok": True/False, "mode": ...}.

    Result is cached for _HEALTH_TTL so frequent platform probes don't run a
    live DB query (and incur a 3s timeout tail) on every hit.
    """
    global _HEALTH_CACHE, _HEALTH_CACHE_AT
    if _USE_MEMORY:
        return {"ok": True, "mode": "in-memory"}

    now = time.monotonic()
    if _HEALTH_CACHE is not None and (now - _HEALTH_CACHE_AT) < _HEALTH_TTL:
        return _HEALTH_CACHE

    try:
        c = _get_client()
        await asyncio.wait_for(
            c.table("sessions").select("id").limit(1).execute(),
            timeout=3.0,
        )
        result = {"ok": True, "mode": "supabase"}
    except Exception as e:
        logger.warning("Health check failed: %s", e)
        result = {"ok": False, "mode": "supabase", "error": str(e)}

    _HEALTH_CACHE = result
    _HEALTH_CACHE_AT = now
    return result


def _get_client():
    if _client is None:
        raise RuntimeError("Supabase client not initialised")
    return _client


# ---------------------------------------------------------------------------
# Retry helper — only for idempotent operations (reads, full-overwrite writes, atomic RPCs)
# ---------------------------------------------------------------------------

_RETRY_ATTEMPTS = 2
_RETRY_DELAY = 0.3  # seconds


async def _with_retry(label: str, coro_fn, *args):
    """Retry an async call up to _RETRY_ATTEMPTS times on transient failure."""
    last_exc = None
    for attempt in range(_RETRY_ATTEMPTS + 1):
        try:
            return await coro_fn(*args)
        except Exception as e:
            last_exc = e
            if attempt < _RETRY_ATTEMPTS:
                logger.warning(
                    "Retrying %s (attempt %d/%d): %s",
                    label, attempt + 1, _RETRY_ATTEMPTS + 1, e,
                )
                await asyncio.sleep(_RETRY_DELAY * (attempt + 1))
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Async public API — delegates to Supabase or in-memory
# ---------------------------------------------------------------------------

async def create_session(user_id: str | None = None) -> dict:
    if _USE_MEMORY:
        sid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        session = {
            "id": sid,
            "user_id": user_id,
            "stage": "intro",
            "state": {},
            "state_version": 0,
            "messages": [],
            "created_at": now,
            "updated_at": now,
        }
        _mem_sessions[sid] = session
        logger.info("In-memory session created: %s", sid[:8])
        return session

    c = _get_client()
    row: dict = {}
    if user_id:
        row["user_id"] = user_id
    result = await c.table("sessions").insert(row).execute()
    return result.data[0]


async def get_session(session_id: str) -> dict | None:
    if _USE_MEMORY:
        return _mem_sessions.get(session_id)

    async def _fetch():
        c = _get_client()
        result = await c.table("sessions").select("*").eq("id", session_id).execute()
        return result.data[0] if result.data else None

    return await _with_retry("get_session", _fetch)


async def load_messages(session_id: str) -> list:
    if _USE_MEMORY:
        s = _mem_sessions.get(session_id)
        return (s.get("messages") or []) if s else []

    async def _fetch():
        c = _get_client()
        result = await (
            c.table("sessions")
            .select("messages")
            .eq("id", session_id)
            .execute()
        )
        if not result.data:
            return []
        return result.data[0].get("messages") or []

    return await _with_retry("load_messages", _fetch)


async def save_messages(session_id: str, messages: list) -> None:
    if _USE_MEMORY:
        if session_id in _mem_sessions:
            _mem_sessions[session_id]["messages"] = messages
        return

    async def _save():
        c = _get_client()
        await (
            c.table("sessions")
            .update({"messages": messages})
            .eq("id", session_id)
            .execute()
        )

    # Full-column overwrite is idempotent, so retrying transient failures is safe.
    await _with_retry("save_messages", _save)


async def update_session_state(session_id: str, new_state: dict) -> dict:
    if _USE_MEMORY:
        s = _mem_sessions.get(session_id)
        if not s:
            raise ValueError(f"Session {session_id} not found")
        s["state"] = new_state
        s["state_version"] = s.get("state_version", 0) + 1
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        return {"state": s["state"], "state_version": s["state_version"]}

    c = _get_client()
    result = await c.rpc(
        "update_session_state_atomic",
        {"p_session_id": session_id, "p_new_state": new_state},
    ).execute()
    if not result.data:
        raise ValueError(f"Session {session_id} not found")
    return result.data[0]


async def advance_stage(session_id: str, stage: str) -> dict:
    if _USE_MEMORY:
        s = _mem_sessions.get(session_id)
        if not s:
            raise ValueError(f"Session {session_id} not found")
        s["stage"] = stage
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        return s

    c = _get_client()
    result = await c.rpc(
        "advance_stage_atomic",
        {"p_session_id": session_id, "p_new_stage": stage},
    ).execute()
    if not result.data:
        raise ValueError(f"Session {session_id} not found")
    return result.data[0]
