"""Domain errors. Pure — no framework or I/O imports."""
from __future__ import annotations


class DomainError(Exception):
    """Base class for all domain-level errors."""


class NotFound(DomainError):
    """A referenced entity (floor, room, package) does not exist."""


class InvariantViolation(DomainError):
    """A command would break a domain invariant (e.g. deleting a mapped package)."""


class PublishBlocked(DomainError):
    """Publish was attempted while the model is incomplete.

    Carries the human-readable open items so callers can surface them.
    """

    def __init__(self, open_items: list[str]) -> None:
        self.open_items = open_items
        super().__init__("Cannot publish — " + "; ".join(open_items))
