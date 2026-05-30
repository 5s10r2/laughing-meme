"""Tarini domain core — pure, framework-free. The only mutation path is Property.apply(command)."""
from __future__ import annotations

from . import commands
from .completeness import compute_completeness
from .errors import DomainError, InvariantViolation, NotFound, PublishBlocked
from .invariants import publish_open_items
from .property import Block, Floor, NamingPattern, Package, Property, Room

__all__ = [
    "commands", "compute_completeness", "publish_open_items",
    "DomainError", "InvariantViolation", "NotFound", "PublishBlocked",
    "Property", "Block", "Floor", "Room", "Package", "NamingPattern",
]
