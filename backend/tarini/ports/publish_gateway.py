"""PublishGateway port — hands a completed property to RentOK core.

The real contract (what RentOK expects) is an open question; this port isolates it so the
rest of the system is built and tested against a stub until the contract lands.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from tarini.domain.property import Property


@dataclass(frozen=True)
class PublishResult:
    ok: bool
    reference: str | None = None
    detail: str | None = None


class PublishGateway(Protocol):
    async def publish(self, session_id: str, prop: Property) -> PublishResult:
        ...
