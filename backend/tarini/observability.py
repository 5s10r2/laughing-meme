"""Observability — structured funnel events for the redesigned path.

Emits one greppable JSON line per event under the `tarini.funnel` logger, so on Render (or any
log aggregator) you can answer the questions that make a flag flip safe to watch:
  - are commands landing?            (commands_applied)
  - how often are they rejected, why? (command_rejected + code)
  - do sessions reach publish?        (published)

Deliberately log-only: no new endpoints, no in-process state, no infra. Counts/funnels are
derived downstream from these lines.
"""
from __future__ import annotations

import json
import logging

logger = logging.getLogger("tarini.funnel")


def emit_event(event: str, **fields) -> dict:
    """Emit a structured funnel event. Returns the record (handy for tests/callers)."""
    record = {"event": event, **fields}
    logger.info("[funnel] %s", json.dumps(record, ensure_ascii=False, sort_keys=True))
    return record
