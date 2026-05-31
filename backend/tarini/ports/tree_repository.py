"""SpaceTreeRepository port — load/save the tree snapshot + append the command log.

Mirrors PropertyRepository (same optimistic-concurrency contract) but for the recursive
SpaceTree aggregate. `load` migrates legacy snapshots on read via SpaceTree.from_snapshot.
"""
from __future__ import annotations

from typing import Protocol

from tarini.domain.space import SpaceTree


class SpaceTreeRepository(Protocol):
    async def load(self, session_id: str) -> SpaceTree | None:
        """Return the stored tree (version set), or None if the session is new."""
        ...

    async def save(self, session_id: str, tree: SpaceTree, *, expected_version: int | None) -> None:
        """Persist the snapshot. `expected_version` None = insert; else optimistic update."""
        ...

    async def append_log(self, session_id: str, entries: list[dict]) -> None:
        """Append command-log entries (audit + future undo/replay)."""
        ...
