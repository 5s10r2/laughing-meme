"""Supabase-backed SpaceTreeRepository — the production adapter for the recursive Space tree.

Reuses the SAME `property_snapshots` table + `save_property_snapshot` compare-and-set RPC
(migration 0002) as the flat model: the `snapshot` column is JSONB, so the tree dict stores
right alongside, and any one session is only ever one shape. No new schema is required.

Back-compat: `load` migrates a legacy Property snapshot into the tree on read
(`SpaceTree.from_snapshot`); the first subsequent edit persists the tree in place at
`version + 1` via the same CAS — so existing PG sessions convert seamlessly, no migration step.

The client is injected (composition root wires the real async client; tests drive a fake),
keeping the adapter free of global state.
"""
from __future__ import annotations

import logging
from typing import Any

from tarini.application.errors import Conflict
from tarini.domain.space import SpaceTree

logger = logging.getLogger(__name__)

_SNAPSHOTS = "property_snapshots"
_LOG = "command_log"


class SupabaseTreeRepository:
    """SpaceTreeRepository over Supabase. Satisfies the `SpaceTreeRepository` port structurally."""

    def __init__(self, client: Any) -> None:
        self._c = client

    async def load(self, session_id: str) -> SpaceTree | None:
        result = await (
            self._c.table(_SNAPSHOTS)
            .select("snapshot")
            .eq("session_id", session_id)
            .execute()
        )
        if not result.data:
            return None
        # from_snapshot auto-detects tree vs legacy → existing PG sessions migrate on read.
        return SpaceTree.from_snapshot(result.data[0]["snapshot"])

    async def save(self, session_id: str, tree: SpaceTree, *, expected_version: int | None) -> None:
        result = await self._c.rpc(
            "save_property_snapshot",
            {
                "p_session_id": session_id,
                "p_snapshot": tree.to_dict(),
                "p_version": tree.version,
                "p_expected_version": expected_version,
            },
        ).execute()
        # Empty = the CAS matched no row: a stale version, or (expected_version=None) a
        # concurrent first-write that already inserted. Either way the caller's view is stale.
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
