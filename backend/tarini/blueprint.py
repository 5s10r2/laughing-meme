"""Blueprint component registry — maps a Living Blueprint component name to the
model→props projection that backs it.

The backend owns blueprint props: the model is the source of truth, so when Claude
emits a blueprint component we compute its props from the current model via the
tested ui_adapter projections rather than trusting Claude-authored arrays. Claude
only chooses WHICH component to show (and passes empty props).

Colour is deliberately absent here too — the frontend maps category/package →
palette. The backend speaks data only.
"""
from __future__ import annotations

from collections.abc import Callable

from tarini.ui_adapter import (
    floor_ledger_props,
    mapping_props,
    massing_props,
    package_panel_props,
    unmapped_props,
)

# Component name → projection(model) -> props.
# "BlueprintMapping" is a frontend wrapper that fans mapping_props.floors into one
# MappingRow per floor; the backend hands it the whole {packages, floors} payload.
_PROJECTIONS: dict[str, Callable[[dict], dict]] = {
    "MassingModel": massing_props,
    "FloorLedger": floor_ledger_props,
    "BlueprintMapping": mapping_props,
    "UnmappedWarning": unmapped_props,
    "PackagePanel": package_panel_props,
}

BLUEPRINT_COMPONENTS = frozenset(_PROJECTIONS)


def is_blueprint_component(component: str) -> bool:
    """True if the component's props are backend-projected (not Claude-authored)."""
    return component in _PROJECTIONS


def blueprint_props(component: str, model: dict) -> dict | None:
    """Compute a blueprint component's props from the model.

    Returns None for non-blueprint components, so the caller falls back to the
    Claude-authored props for legacy cards.
    """
    projection = _PROJECTIONS.get(component)
    return projection(model) if projection else None
