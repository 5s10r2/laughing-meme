"""Application-layer errors."""
from __future__ import annotations


class Conflict(Exception):
    """Optimistic-concurrency conflict — the session moved on since the caller loaded it."""
