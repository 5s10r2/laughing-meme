"""Completeness engine — derives 'what's done / what's left' from the model.

Replaces linear stage gates: the owner works any facet in any order; this tells the
agent what to nudge, and whether the property is publishable. Pure.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from .invariants import publish_open_items

if TYPE_CHECKING:
    from .property import Property

Status = str  # "empty" | "partial" | "complete"


def _tri(any_: bool, all_: bool) -> Status:
    if all_:
        return "complete"
    return "partial" if any_ else "empty"


def compute_completeness(p: "Property") -> dict:
    # property facet
    fields = [bool(p.name), bool(p.type), bool(p.location)]
    prop = _tri(any(fields), all(fields))

    # structure facet — every active floor has at least one room
    active_floors = [f for f in p.floors if f.active]
    floors_with_rooms = [f for f in active_floors if any(r.floor_id == f.id for r in p.rooms)]
    structure = _tri(
        bool(p.floors),
        bool(active_floors) and len(floors_with_rooms) == len(active_floors),
    )

    # packages facet — at least one, all active have rent
    active_pkgs = [pk for pk in p.packages if pk.active]
    packages = _tri(
        bool(p.packages),
        bool(active_pkgs) and all(pk.rent is not None for pk in active_pkgs),
    )

    # mapping facet — every active room mapped or marked unavailable
    active_rooms = [r for r in p.rooms if r.status == "active"]
    mapped = [r for r in active_rooms if r.package_id]
    mapping = _tri(
        bool(mapped),
        bool(active_rooms) and len(mapped) == len(active_rooms),
    )

    open_items = publish_open_items(p)
    return {
        "facets": {"property": prop, "structure": structure,
                   "packages": packages, "mapping": mapping},
        "open_items": open_items,
        "publishable": not open_items,
        "counts": {
            "floors": len(p.floors),
            "rooms": len(p.rooms),
            "packages": len(active_pkgs),
            "rooms_mapped": len(mapped),
        },
    }
