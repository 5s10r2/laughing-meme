"""TreeCommandService — the application entry point for reading/mutating a SpaceTree.

The tree-native counterpart of CommandService, with the identical contract (get_model /
apply → {model, completeness, version, warnings}, optimistic concurrency, idempotency,
batch atomicity). Both the agent and direct Blueprint edits call it once the tree model
is switched on. A failing command in a batch persists nothing (applied on a detached copy).
"""
from __future__ import annotations

import logging
from dataclasses import asdict

from tarini.domain.space import SpaceTree
from tarini.domain.space_completeness import compute_completeness
from tarini.ports.tree_repository import SpaceTreeRepository

from .errors import Conflict

logger = logging.getLogger(__name__)


class TreeCommandService:
    def __init__(self, repo: SpaceTreeRepository) -> None:
        self._repo = repo
        self._idempotency: dict[tuple[str, str], dict] = {}

    async def get_model(self, session_id: str) -> dict:
        tree = await self._repo.load(session_id)
        if tree is None:
            # Unlike the flat model, the tree needs a stable root id to add under, so a new
            # session is initialised + persisted on first read (the agent always reads first).
            # Insert semantics + reload-on-conflict: if a concurrent first-read (e.g. a Blueprint
            # GET /model racing the first chat turn) already created the session, adopt its root
            # rather than clobbering it with a divergent root_id.
            tree = SpaceTree.new("")
            try:
                await self._repo.save(session_id, tree, expected_version=None)
            except Conflict:
                tree = await self._repo.load(session_id) or tree
        return self._snapshot(tree, warnings=[])

    async def apply(
        self,
        session_id: str,
        commands: list,
        *,
        expected_version: int | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        """Apply a batch atomically. Raises DomainError/Conflict on failure (nothing persisted)."""
        idem = (session_id, idempotency_key) if idempotency_key else None
        if idem and idem in self._idempotency:
            return self._idempotency[idem]

        existing = await self._repo.load(session_id)
        base_version = existing.version if existing else 0
        if expected_version is not None and expected_version != base_version:
            raise Conflict(f"expected version {expected_version}, current {base_version}")

        # Detached copy → atomicity: if any command raises, storage is untouched.
        tree = SpaceTree.from_dict(existing.to_dict()) if existing else SpaceTree.new("")

        for cmd in commands:
            tree.apply(cmd)

        tree.version = base_version + 1
        await self._repo.save(
            session_id, tree, expected_version=(base_version if existing else None)
        )
        await self._repo.append_log(
            session_id,
            [{"v": tree.version, "type": type(cmd).__name__, "args": asdict(cmd)} for cmd in commands],
        )

        result = self._snapshot(tree, warnings=[])
        if idem:
            self._idempotency[idem] = result
        return result

    @staticmethod
    def _snapshot(tree: SpaceTree, *, warnings: list[str]) -> dict:
        return {
            "model": tree.to_dict(),
            "completeness": compute_completeness(tree),
            "version": tree.version,
            "warnings": warnings,
        }
