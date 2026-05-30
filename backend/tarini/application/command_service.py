"""CommandService — the single application entry point for reading and mutating a property.

Both the agent (`apply_commands`) and direct UI edits (`/commands`) call this. It:
  - loads the aggregate (or starts a new one),
  - applies a batch of commands on a DETACHED copy (so a failing command persists nothing),
  - enforces optimistic concurrency + idempotency,
  - persists snapshot + command log,
  - returns model + completeness + warnings.
"""
from __future__ import annotations

import logging
from dataclasses import asdict

from tarini.domain import compute_completeness
from tarini.domain.commands import Command
from tarini.domain.property import Property
from tarini.ports.repository import PropertyRepository

from .errors import Conflict

logger = logging.getLogger(__name__)


class CommandService:
    def __init__(self, repo: PropertyRepository) -> None:
        self._repo = repo
        self._idempotency: dict[tuple[str, str], dict] = {}

    async def get_model(self, session_id: str) -> dict:
        prop = await self._repo.load(session_id) or Property()
        return self._snapshot(prop, warnings=[])

    async def apply(
        self,
        session_id: str,
        commands: list[Command],
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
        prop = Property.from_dict(existing.to_dict()) if existing else Property()

        warnings: list[str] = []
        for cmd in commands:
            warnings.extend(prop.apply(cmd))

        prop.version = base_version + 1
        await self._repo.save(
            session_id, prop, expected_version=(base_version if existing else None)
        )
        await self._repo.append_log(
            session_id,
            [{"v": prop.version, "type": type(cmd).__name__, "args": asdict(cmd)} for cmd in commands],
        )

        result = self._snapshot(prop, warnings=warnings)
        if idem:
            self._idempotency[idem] = result
        return result

    @staticmethod
    def _snapshot(prop: Property, *, warnings: list[str]) -> dict:
        return {
            "model": prop.to_dict(),
            "completeness": compute_completeness(prop),
            "version": prop.version,
            "warnings": warnings,
        }
