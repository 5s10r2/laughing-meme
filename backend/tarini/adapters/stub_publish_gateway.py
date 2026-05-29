"""Stub PublishGateway — until the real RentOK publish contract is known.

Records that a publish happened and returns a reference. Swapping in the real RentOK
adapter later requires no change anywhere else (that's the point of the port).
"""
from __future__ import annotations

import logging

from tarini.domain.property import Property
from tarini.ports.publish_gateway import PublishResult

logger = logging.getLogger(__name__)


class StubPublishGateway:
    async def publish(self, session_id: str, prop: Property) -> PublishResult:
        logger.info(
            "PUBLISH (stub) session=%s property=%r floors=%d rooms=%d packages=%d",
            session_id, prop.name, len(prop.floors), len(prop.rooms), len(prop.packages),
        )
        return PublishResult(ok=True, reference=f"stub_{session_id[:8]}", detail="published via stub")
