"""Publish invariants — what must be true before a property can go live.

Pure functions. Imported by the aggregate (Publish command) and the completeness engine.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .property import Property


def publish_open_items(p: "Property") -> list[str]:
    """Return human-readable reasons the property is not yet publishable (empty == ready)."""
    items: list[str] = []

    for label, value in (("a property name", p.name), ("a property type", p.type),
                         ("a location", p.location)):
        if not value:
            items.append(f"Needs {label}")

    if not p.floors:
        items.append("No floors added yet")
    if not p.packages:
        items.append("No packages created yet")

    for pkg in p.packages:
        if pkg.active and pkg.rent is None:
            items.append(f"Package '{pkg.name}' has no starting rent")

    unmapped = [r for r in p.rooms if r.status == "active" and not r.package_id]
    if unmapped:
        items.append(f"{len(unmapped)} room(s) not mapped to a package")

    return items
