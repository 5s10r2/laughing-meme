"""
Supabase client singleton + session helpers.

Falls back to a pure in-memory store when Supabase is unreachable,
so local development works without network access.
"""
import asyncio
import logging
import os
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


def _get_client():
    if _client is None:
        raise RuntimeError("Supabase client not initialised")
    return _client


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

    c = _get_client()
    result = await c.table("sessions").select("*").eq("id", session_id).execute()
    return result.data[0] if result.data else None


async def load_messages(session_id: str) -> list:
    if _USE_MEMORY:
        s = _mem_sessions.get(session_id)
        return (s.get("messages") or []) if s else []

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


async def save_messages(session_id: str, messages: list) -> None:
    if _USE_MEMORY:
        if session_id in _mem_sessions:
            _mem_sessions[session_id]["messages"] = messages
        return

    c = _get_client()
    await (
        c.table("sessions")
        .update({"messages": messages})
        .eq("id", session_id)
        .execute()
    )


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
    result = await (
        c.table("sessions")
        .update({"stage": stage})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]
