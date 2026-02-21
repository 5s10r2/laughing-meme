"""
Supabase client singleton + session helpers.

Uses the native async supabase-py client so it works correctly inside
FastAPI's async event loop without thread-pool wrappers.

The client is initialised once during app startup (via init_client / close_client)
and stored as a module-level variable — a simple, safe pattern for FastAPI apps.
"""
import os

from supabase import AsyncClient, acreate_client


# ---------------------------------------------------------------------------
# Module-level async client (set during lifespan startup)
# ---------------------------------------------------------------------------

_client: AsyncClient | None = None


async def init_client() -> None:
    """Call once during FastAPI lifespan startup."""
    global _client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    _client = await acreate_client(url, key)


async def close_client() -> None:
    """Call once during FastAPI lifespan shutdown."""
    global _client
    _client = None  # AsyncClient has no explicit close — GC handles cleanup


def _get_client() -> AsyncClient:
    if _client is None:
        raise RuntimeError("Supabase client not initialised — call init_client() first")
    return _client


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def create_session(user_id: str | None = None) -> dict:
    """Create a new session row. Returns the full session dict."""
    c = _get_client()
    row: dict = {}
    if user_id:
        row["user_id"] = user_id
    result = await c.table("sessions").insert(row).execute()
    return result.data[0]


async def get_session(session_id: str) -> dict | None:
    """Fetch a session by ID. Returns None if not found."""
    c = _get_client()
    result = await c.table("sessions").select("*").eq("id", session_id).execute()
    return result.data[0] if result.data else None


async def load_messages(session_id: str) -> list:
    """Load conversation history from the session's messages JSONB column."""
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
    """Persist conversation history to the session's messages JSONB column."""
    c = _get_client()
    await (
        c.table("sessions")
        .update({"messages": messages})
        .eq("id", session_id)
        .execute()
    )


async def update_session_state(session_id: str, new_state: dict) -> dict:
    """Replace the session's state JSONB blob and increment state_version atomically.

    Uses the update_session_state_atomic Postgres RPC — no extra round-trip, no race.
    """
    c = _get_client()
    result = await c.rpc(
        "update_session_state_atomic",
        {"p_session_id": session_id, "p_new_state": new_state},
    ).execute()
    if not result.data:
        raise ValueError(f"Session {session_id} not found")
    return result.data[0]


async def advance_stage(session_id: str, stage: str) -> dict:
    """Update the stage field."""
    c = _get_client()
    result = await (
        c.table("sessions")
        .update({"stage": stage})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]
