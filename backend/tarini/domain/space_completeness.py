"""Completeness engine for the Space tree — 'what's done / what's left', derived.

The generic equivalent of the legacy engine: instead of floors/rooms/packages it reasons
over the tree's `rentable` markers + `offerings`, so the same four facets describe a PG, a
flat building, or a per-bed setup uniformly. Pure functions; no I/O.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .space import SpaceTree

Status = str  # "empty" | "partial" | "complete"


def _tri(any_: bool, all_: bool) -> Status:
    if all_:
        return "complete"
    return "partial" if any_ else "empty"


def _rentable(tree: "SpaceTree") -> list:
    return [s for s in tree.spaces.values() if s.rentable]


def _active_rentable(tree: "SpaceTree") -> list:
    return [s for s in _rentable(tree) if s.status == "active"]


def publish_open_items(tree: "SpaceTree") -> list[str]:
    """Human-readable reasons the property is not yet publishable (empty == ready)."""
    items: list[str] = []

    for label, value in (("a property name", tree.meta.get("name")),
                         ("a property type", tree.meta.get("type")),
                         ("a location", tree.meta.get("location"))):
        if not value:
            items.append(f"Needs {label}")

    if not _rentable(tree):
        items.append("No rentable inventory added yet")
    if not tree.offerings:
        items.append("No offerings created yet")

    for off in tree.offerings.values():
        if off.active and off.price is None:
            items.append(f"Offering '{off.name}' has no starting rent")

    unmapped = [s for s in _active_rentable(tree) if not s.offering_id]
    if unmapped:
        items.append(f"{len(unmapped)} unit(s) not mapped to an offering")

    return items


def compute_completeness(tree: "SpaceTree") -> dict:
    # property facet
    fields = [bool(tree.meta.get("name")), bool(tree.meta.get("type")), bool(tree.meta.get("location"))]
    prop = _tri(any(fields), all(fields))

    # structure facet — has the inventory been laid out, with sellable units identified?
    has_children = len(tree.spaces) > 1
    rentable = _rentable(tree)
    structure = _tri(has_children, bool(rentable))

    # offerings facet — at least one, all active priced
    active_offerings = [o for o in tree.offerings.values() if o.active]
    offerings = _tri(
        bool(tree.offerings),
        bool(active_offerings) and all(o.price is not None for o in active_offerings),
    )

    # mapping facet — every active rentable unit mapped to an offering
    active = _active_rentable(tree)
    mapped = [s for s in active if s.offering_id]
    mapping = _tri(bool(mapped), bool(active) and len(mapped) == len(active))

    open_items = publish_open_items(tree)
    return {
        "facets": {"property": prop, "structure": structure,
                   "offerings": offerings, "mapping": mapping},
        "open_items": open_items,
        "publishable": not open_items,
        "counts": {
            "rentable": len(rentable),
            "rentable_mapped": len(mapped),
            "offerings": len(active_offerings),
        },
    }
