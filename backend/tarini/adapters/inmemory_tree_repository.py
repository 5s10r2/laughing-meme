"""In-memory SpaceTreeRepository — local dev, tests, and the in-memory fallback mode.

Stores dict snapshots; `load` reconstructs via SpaceTree.from_snapshot so a session
persisted under the legacy Property shape migrates to the tree transparently on read.
"""
from __future__ import annotations

from tarini.application.errors import Conflict
from tarini.domain.space import SpaceTree


class InMemoryTreeRepository:
    def __init__(self) -> None:
        self._store: dict[str, dict] = {}  # session_id -> {"snapshot": dict, "log": list}

    async def load(self, session_id: str) -> SpaceTree | None:
        rec = self._store.get(session_id)
        return SpaceTree.from_snapshot(rec["snapshot"]) if rec else None

    async def save(self, session_id: str, tree: SpaceTree, *, expected_version: int | None) -> None:
        rec = self._store.get(session_id)
        current = rec["snapshot"].get("version") if rec and rec.get("snapshot") else None
        if expected_version is not None and current != expected_version:
            raise Conflict(f"expected version {expected_version}, current {current}")
        self._store.setdefault(session_id, {"log": []})["snapshot"] = tree.to_dict()

    async def append_log(self, session_id: str, entries: list[dict]) -> None:
        self._store.setdefault(session_id, {"snapshot": {}, "log": []})["log"].extend(entries)
