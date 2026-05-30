"""UI adapter — projects a CommandService snapshot into the legacy frontend shape.

The redesigned model (Property.to_dict) and the live frontend's OnboardingState use different
field names (name → property_name, rooms → units, rent → starting_rent, …) and the frontend
keys a stage progress bar off a `stage` the redesign retired. This adapter bridges the two so
the EXISTING frontend renders the new backend correctly while USE_NEW_EXPERIENCE is on.

It is deliberately a presentation-only projection (pure, no I/O): the model stays the single
source of truth. Phase B retargets this adapter to the Living Blueprint components.
"""
from __future__ import annotations


def normalize_gender(value: str | None) -> str | None:
    """Map a free-text gender to the frontend enum (male | female | coed), or None."""
    if not value:
        return None
    v = value.strip().lower()
    if not v:
        return None
    if any(t in v for t in ("co-ed", "coed", "co ed", "mixed", "unisex")):
        return "coed"
    if any(t in v for t in ("female", "girl", "women", "ladies")):
        return "female"
    if any(t in v for t in ("male", "boy", "men", "gents")):
        return "male"
    return v  # pass through anything already canonical / unknown


_FACET_ORDER = (
    ("property", "intro"),
    ("structure", "structure"),
    ("packages", "packages"),
    ("mapping", "mapping"),
)


def derive_stage(facets: dict) -> str:
    """Derive a legacy stage label from completeness facets (for the progress bar).

    The first facet that isn't 'complete' names the stage in progress; if all are complete,
    we're at verification.
    """
    for facet, stage in _FACET_ORDER:
        if facets.get(facet) != "complete":
            return stage
    return "verification"


def _floor_index_by_id(model: dict) -> dict[str, int]:
    return {f["id"]: f["index"] for f in model.get("floors", [])}


def _legacy_floor(f: dict) -> dict:
    return {"index": f["index"], "label": f["label"], "active": f.get("active", True)}


def _legacy_unit(room: dict, floor_index_by_id: dict[str, int]) -> dict:
    return {
        "id": room["id"],
        "name": room.get("name", ""),
        "floor_index": floor_index_by_id.get(room.get("floor_id"), 0),
        "category": room.get("category", "room"),
        "sharing_type": room.get("sharing"),
        "package_id": room.get("package_id"),
        "active": room.get("status", "active") == "active",
    }


def _legacy_package(pkg: dict) -> dict:
    food = pkg.get("food", "none")
    return {
        "id": pkg["id"],
        "name": pkg["name"],
        # the new model has no package category; default keeps frontend components that
        # assume a string from breaking (this shim is replaced in Phase B).
        "category": "room",
        "sharing_type": pkg.get("sharing"),
        "furnishing": pkg.get("furnishing"),
        "amenities": pkg.get("amenities", []),
        "food_included": food == "included",
        "food_optional": food == "optional",
        "starting_rent": pkg.get("rent"),
        "active": pkg.get("active", True),
    }


def to_legacy_state(model: dict) -> dict:
    """Project the Property model dict into the legacy OnboardingState shape."""
    floor_index_by_id = _floor_index_by_id(model)
    return {
        "user_name": model.get("owner_name"),
        "property_name": model.get("name"),
        "property_type": model.get("type"),
        "property_location": model.get("location"),
        "gender_preference": normalize_gender(model.get("gender")),
        "floors": [_legacy_floor(f) for f in model.get("floors", [])],
        "units": [_legacy_unit(r, floor_index_by_id) for r in model.get("rooms", [])],
        "packages": [_legacy_package(p) for p in model.get("packages", [])],
        "naming_patterns": {
            scope: {"pattern": np.get("pattern"), "start": np.get("start", 1)}
            for scope, np in (model.get("naming") or {}).items()
        },
    }


def to_legacy_session_snapshot(snapshot: dict) -> dict:
    """Build the `state_snapshot` payload (state + derived stage + version) the frontend expects.

    `snapshot` is a CommandService snapshot: {model, completeness, version, warnings}.
    """
    model = snapshot.get("model", {})
    facets = snapshot.get("completeness", {}).get("facets", {})
    return {
        "state": to_legacy_state(model),
        "stage": derive_stage(facets),
        "stateVersion": snapshot.get("version", 0),
    }
