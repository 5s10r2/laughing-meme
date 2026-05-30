"""A faithful in-process fake of the async Supabase client — just the surface the
SupabasePropertyRepository touches: `.table(t).select().eq().execute()`,
`.table(t).insert(rows).execute()`, and `.rpc(name, params).execute()`.

Crucially it reproduces the `save_property_snapshot` compare-and-set semantics from
migration 0002 in Python, so tests exercise the SAME optimistic-concurrency behaviour the
real RPC enforces — without a live database.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class _Result:
    data: list


class _TableQuery:
    def __init__(self, store: "FakeSupabase", table: str) -> None:
        self._store = store
        self._table = table
        self._filters: dict = {}
        self._pending_insert: list | None = None

    def select(self, *_cols) -> "_TableQuery":
        return self

    def eq(self, col: str, val) -> "_TableQuery":
        self._filters[col] = val
        return self

    def insert(self, rows) -> "_TableQuery":
        self._pending_insert = rows if isinstance(rows, list) else [rows]
        return self

    async def execute(self) -> _Result:
        if self._pending_insert is not None:
            self._store.tables.setdefault(self._table, []).extend(self._pending_insert)
            return _Result(data=list(self._pending_insert))
        rows = self._store.tables.get(self._table, [])
        for col, val in self._filters.items():
            rows = [r for r in rows if r.get(col) == val]
        return _Result(data=list(rows))


class _RpcQuery:
    def __init__(self, store: "FakeSupabase", name: str, params: dict) -> None:
        self._store = store
        self._name = name
        self._params = params

    async def execute(self) -> _Result:
        if self._name == "save_property_snapshot":
            return _Result(data=self._store._save_snapshot(self._params))
        raise NotImplementedError(f"fake has no RPC {self._name!r}")


class FakeSupabase:
    """Mimics the async supabase client builder chain backed by plain dicts."""

    def __init__(self) -> None:
        # property_snapshots keyed by session_id; other tables are plain row lists.
        self._snapshots: dict[str, dict] = {}
        self.tables: dict[str, list] = {}

    def table(self, name: str) -> _TableQuery:
        if name == "property_snapshots":
            # surface snapshots as a row list so select/eq works uniformly
            self.tables["property_snapshots"] = [
                {"session_id": sid, **rec} for sid, rec in self._snapshots.items()
            ]
        return _TableQuery(self, name)

    def rpc(self, name: str, params: dict) -> _RpcQuery:
        return _RpcQuery(self, name, params)

    # ---- save_property_snapshot CAS, mirroring migration 0002 ----
    def _save_snapshot(self, p: dict) -> list:
        sid = p["p_session_id"]
        expected = p["p_expected_version"]
        existing = self._snapshots.get(sid)

        if expected is None:
            if existing is not None:
                return []  # ON CONFLICT (session_id) DO NOTHING
            rec = {"snapshot": p["p_snapshot"], "version": p["p_version"]}
            self._snapshots[sid] = rec
            return [{"session_id": sid, **rec}]

        # versioned update — only if the stored version still matches
        if existing is None or existing["version"] != expected:
            return []
        rec = {"snapshot": p["p_snapshot"], "version": p["p_version"]}
        self._snapshots[sid] = rec
        return [{"session_id": sid, **rec}]
