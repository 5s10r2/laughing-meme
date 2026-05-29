"""In-memory PropertyRepository — for local dev, tests, and the in-memory fallback mode."""
from __future__ import annotations

from tarini.application.errors import Conflict
from tarini.domain.property import Property


class InMemoryPropertyRepository:
    def __init__(self) -> None:
        self._store: dict[str, dict] = {}  # session_id -> {"snapshot": dict, "log": list}

    async def load(self, session_id: str) -> Property | None:
        rec = self._store.get(session_id)
        return Property.from_dict(rec["snapshot"]) if rec else None

    async def save(self, session_id: str, prop: Property, *, expected_version: int | None) -> None:
        rec = self._store.get(session_id)
        current = rec["snapshot"]["version"] if rec else None
        if expected_version is not None and current != expected_version:
            raise Conflict(f"expected version {expected_version}, current {current}")
        self._store.setdefault(session_id, {"log": []})["snapshot"] = prop.to_dict()

    async def append_log(self, session_id: str, entries: list[dict]) -> None:
        self._store.setdefault(session_id, {"snapshot": {}, "log": []})["log"].extend(entries)
