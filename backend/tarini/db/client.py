"""
Supabase client singleton + session helpers.

Uses the synchronous supabase-py client wrapped with asyncio.to_thread() so it
plays nicely with FastAPI's async handlers without introducing extra dependencies.
"""
import asyncio
import os
from functools import lru_cache

from supabase import Client, create_client


# ---------------------------------------------------------------------------
# Singleton sync client
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Sync helpers (run inside asyncio.to_thread)
# ---------------------------------------------------------------------------

def _sync_create_session(user_id: str | None = None) -> dict:
    client = _get_client()
    row: dict = {}
    if user_id:
        row["user_id"] = user_id
    result = client.table("sessions").insert(row).execute()
    return result.data[0]


def _sync_get_session(session_id: str) -> dict | None:
    client = _get_client()
    result = (
        client.table("sessions")
        .select("*")
        .eq("id", session_id)
        .execute()
    )
    return result.data[0] if result.data else None


def _sync_update_sdk_session_id(session_id: str, sdk_session_id: str) -> dict:
    client = _get_client()
    result = (
        client.table("sessions")
        .update({"sdk_session_id": sdk_session_id})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


def _sync_update_session_state(session_id: str, new_state: dict) -> dict:
    """Single atomic UPDATE via Postgres RPC — increments state_version in one statement.

    supabase-py serialises the Python dict to JSONB automatically; no json.dumps() needed.
    Eliminates the read-modify-write race that existed when Python did:
      get_session → compute new_version → table.update(...)
    """
    c = _get_client()
    result = c.rpc(
        "update_session_state_atomic",
        {"p_session_id": session_id, "p_new_state": new_state},
    ).execute()
    if not result.data:
        raise ValueError(f"Session {session_id} not found")
    return result.data[0]


def _sync_advance_stage(session_id: str, stage: str) -> dict:
    client = _get_client()
    result = (
        client.table("sessions")
        .update({"stage": stage})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def create_session(user_id: str | None = None) -> dict:
    """Create a new session row. Returns the full session dict."""
    return await asyncio.to_thread(_sync_create_session, user_id)


async def get_session(session_id: str) -> dict | None:
    """Fetch a session by ID. Returns None if not found."""
    return await asyncio.to_thread(_sync_get_session, session_id)


async def update_sdk_session_id(session_id: str, sdk_session_id: str) -> dict:
    """Persist the Claude SDK session ID for future resumption."""
    return await asyncio.to_thread(_sync_update_sdk_session_id, session_id, sdk_session_id)


async def update_session_state(session_id: str, new_state: dict) -> dict:
    """Replace the session's state JSONB blob and increment state_version atomically.

    The caller is responsible for the merge (done in tools/state.py); this just persists.
    Uses the update_session_state_atomic Postgres RPC — no extra round-trip, no race.
    """
    return await asyncio.to_thread(_sync_update_session_state, session_id, new_state)


async def advance_stage(session_id: str, stage: str) -> dict:
    """Update the stage field."""
    return await asyncio.to_thread(_sync_advance_stage, session_id, stage)
