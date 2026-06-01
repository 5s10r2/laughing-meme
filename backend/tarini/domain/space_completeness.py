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


def _offering_complete(o) -> bool:
    """An active offering is fully specified for publishing: priced, with a security
    deposit, notice period, and lock-in all *answered*. 0 is a valid answer (a zero-deposit
    PG, or no lock-in) — only None means 'not asked yet', which blocks publish."""
    return (
        o.price is not None
        and (o.deposit_months is not None or o.deposit_amount is not None)
        and o.notice_days is not None
        and o.lock_in_months is not None
    )


def _rentable(tree: "SpaceTree") -> list:
    return [s for s in tree.spaces.values() if s.rentable]


def _active_rentable(tree: "SpaceTree") -> list:
    return [s for s in _rentable(tree) if s.status == "active"]


def publish_open_items(tree: "SpaceTree") -> list[str]:
    """Human-readable reasons the property is not yet publishable (empty == ready)."""
    items: list[str] = []

    for label, value in (("a property name", tree.meta.get("name")),
                         ("a property type", tree.meta.get("type")),
                         ("a location", tree.meta.get("location")),
                         ("a gender preference (Boys / Girls / Co-ed)", tree.meta.get("gender"))):
        if not value:
            items.append(f"Needs {label}")

    if not _rentable(tree):
        items.append("No rentable inventory added yet")
    if not tree.offerings:
        items.append("No offerings created yet")

    for off in tree.offerings.values():
        if not off.active:
            continue
        if off.price is None:
            items.append(f"Offering '{off.name}' has no starting rent")
        if off.deposit_months is None and off.deposit_amount is None:
            items.append(f"Offering '{off.name}' needs a security deposit (0 if none)")
        if off.notice_days is None:
            items.append(f"Offering '{off.name}' needs a notice period")
        if off.lock_in_months is None:
            items.append(f"Offering '{off.name}' needs a lock-in period (0 if none)")

    unmapped = [s for s in _active_rentable(tree) if not s.offering_id]
    if unmapped:
        items.append(f"{len(unmapped)} unit(s) not mapped to an offering")

    return items


def compute_completeness(tree: "SpaceTree") -> dict:
    # property facet — name, type, location, and gender preference
    fields = [bool(tree.meta.get("name")), bool(tree.meta.get("type")),
              bool(tree.meta.get("location")), bool(tree.meta.get("gender"))]
    prop = _tri(any(fields), all(fields))

    # structure facet — has the inventory been laid out, with sellable units identified?
    has_children = len(tree.spaces) > 1
    rentable = _rentable(tree)
    structure = _tri(has_children, bool(rentable))

    # offerings facet — at least one, all active fully specified (price + deposit + notice + lock-in)
    active_offerings = [o for o in tree.offerings.values() if o.active]
    offerings = _tri(
        bool(tree.offerings),
        bool(active_offerings) and all(_offering_complete(o) for o in active_offerings),
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
