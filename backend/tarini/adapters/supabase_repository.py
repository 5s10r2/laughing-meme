"""Supabase-backed PropertyRepository — the production adapter for the redesigned backend.

Persists the Property aggregate as a JSONB snapshot with an optimistic-concurrency version,
and appends the command log. All writes go through the `save_property_snapshot` RPC so the
compare-and-set is atomic in the database (migration 0002).

The Supabase client is injected (the composition root wires in the real async client), which
keeps this adapter pure of global state and lets the test suite drive it with a fake client.
"""
from __future__ import annotations

import logging
from typing import Any

from tarini.application.errors import Conflict
from tarini.domain.property import Property

logger = logging.getLogger(__name__)

_SNAPSHOTS = "property_snapshots"
_LOG = "command_log"


class SupabasePropertyRepository:
    """PropertyRepository over Supabase. Satisfies the `PropertyRepository` port structurally."""

    def __init__(self, client: Any) -> None:
        self._c = client

    async def load(self, session_id: str) -> Property | None:
        result = await (
            self._c.table(_SNAPSHOTS)
            .select("snapshot")
            .eq("session_id", session_id)
            .execute()
        )
        if not result.data:
            return None
        return Property.from_dict(result.data[0]["snapshot"])

    async def save(self, session_id: str, prop: Property, *, expected_version: int | None) -> None:
        result = await self._c.rpc(
            "save_property_snapshot",
            {
                "p_session_id": session_id,
                "p_snapshot": prop.to_dict(),
                "p_version": prop.version,
                "p_expected_version": expected_version,
            },
        ).execute()
        # Empty result = the CAS matched no row: a stale version, or a concurrent first-write
        # that already inserted this session. Either way the caller's view is stale.
        if not result.data:
            raise Conflict(
                f"snapshot save conflict for session {session_id} "
                f"(expected version {expected_version})"
            )

    async def append_log(self, session_id: str, entries: list[dict]) -> None:
        if not entries:
            return
        rows = [
            {
                "session_id": session_id,
                "version": e["v"],
                "command_type": e["type"],
                "args": e["args"],
            }
            for e in entries
        ]
        await self._c.table(_LOG).insert(rows).execute()
