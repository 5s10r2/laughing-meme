"""PropertyRepository port — load/save the aggregate snapshot + append the command log.

Optimistic concurrency: `save` is given the version the caller started from; an adapter
rejects the write if storage has moved on (talk-and-touch racing on the same session).
"""
from __future__ import annotations

from typing import Protocol

from tarini.domain.property import Property


class PropertyRepository(Protocol):
    async def load(self, session_id: str) -> Property | None:
        """Return the stored aggregate (version set), or None if the session is new."""
        ...

    async def save(self, session_id: str, prop: Property, *, expected_version: int | None) -> None:
        """Persist the snapshot. `expected_version` None = insert; else optimistic update."""
        ...

    async def append_log(self, session_id: str, entries: list[dict]) -> None:
        """Append command-log entries (audit + future undo/replay)."""
        ...
