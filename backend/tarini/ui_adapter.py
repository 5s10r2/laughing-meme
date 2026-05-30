"""UI adapter — projects a CommandService snapshot into the legacy frontend shape.

The redesigned model (Property.to_dict) and the live frontend's OnboardingState use different
field names (name → property_name, rooms → units, rent → starting_rent, …) and the frontend
keys a stage progress bar off a `stage` the redesign retired. This adapter bridges the two so
the EXISTING frontend renders the new backend correctly while USE_NEW_EXPERIENCE is on.

It is deliberately a presentation-only projection (pure, no I/O): the model stays the single
source of truth. Phase B retargets this adapter to the Living Blueprint components.
"""
from __future__ import annotations

import re


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


# =========================================================================== #
#  Phase B — Living Blueprint component projections                            #
#                                                                             #
#  Pure presentation projections of the Property model into the props the new #
#  blueprint components consume. Colour is deliberately NOT emitted — the     #
#  frontend maps category/package → palette; the backend speaks only data.    #
# =========================================================================== #

def _active_floors(model: dict) -> list[dict]:
    return [f for f in model.get("floors", []) if f.get("active", True)]


def _active_rooms(model: dict) -> list[dict]:
    return [r for r in model.get("rooms", []) if r.get("status", "active") == "active"]


def _rooms_on(rooms: list[dict], floor_id: str) -> list[dict]:
    return [r for r in rooms if r.get("floor_id") == floor_id]


def _floors_top_down(model: dict) -> list[dict]:
    return sorted(_active_floors(model), key=lambda f: f["index"], reverse=True)


def _category(room: dict) -> str:
    return room.get("category") or "room"


def _active_package_ids(model: dict) -> set[str]:
    return {p["id"] for p in model.get("packages", []) if p.get("active", True)}


def _is_mapped(room: dict, active_pkg_ids: set[str]) -> bool:
    """A room is mapped only if its package_id resolves to a LIVE package — a
    dangling/inactive reference reads as unmapped (mirrors the frontend isMapped)."""
    pid = room.get("package_id")
    return bool(pid) and pid in active_pkg_ids


def _unit_base(room: dict) -> dict:
    return {"id": room["id"], "name": room.get("name", "")}


def _typed_unit(room: dict) -> dict:
    return {**_unit_base(room), "category": _category(room)}


def _mapping_unit(room: dict) -> dict:
    return {**_typed_unit(room), "packageId": room.get("package_id")}


def _natkey(s: str) -> list:
    """Natural sort key so '9' < '10' (room names may be mixed-width)."""
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def _mix_segments(rooms: list[dict]) -> list[dict]:
    """Group rooms by category (first-seen order) → [{key,label,count}]. No colour."""
    order: list[str] = []
    counts: dict[str, int] = {}
    for r in rooms:
        cat = _category(r)
        if cat not in counts:
            counts[cat] = 0
            order.append(cat)
        counts[cat] += 1
    return [{"key": cat, "label": cat, "count": counts[cat]} for cat in order]


def _name_range(rooms: list[dict]) -> str | None:
    names = sorted((r["name"] for r in rooms if r.get("name")), key=_natkey)
    if not names:
        return None
    return names[0] if names[0] == names[-1] else f"{names[0]}–{names[-1]}"


def massing_props(model: dict) -> dict:
    """Props for MassingModel — blocks (with floor counts), name, meta, stats."""
    floors = _active_floors(model)
    rooms = _active_rooms(model)
    per_block: dict[str | None, int] = {}
    for f in floors:
        per_block[f.get("block_id")] = per_block.get(f.get("block_id"), 0) + 1
    blocks_src = model.get("blocks") or []
    blocks = [
        {"label": b["label"], "floors": per_block.get(b["id"], 0), "accentTop": i == 0}
        for i, b in enumerate(blocks_src)
    ]
    if not blocks and floors:
        blocks = [{"label": "Main", "floors": len(floors), "accentTop": True}]
    categories = {_category(r) for r in rooms}
    location = model.get("location")
    meta_parts: list[str] = []
    if location:
        meta_parts.append(location)
    meta_parts.append(f"{len(blocks)} block{'s' if len(blocks) != 1 else ''}")
    return {
        "propertyName": model.get("name") or "Your property",
        "meta": " · ".join(meta_parts),
        "blocks": blocks,
        "stats": [
            {"label": "Floors", "value": len(floors)},
            {"label": "Rooms", "value": len(rooms)},
            {"label": "Types", "value": len(categories)},
        ],
    }


def floor_ledger_props(model: dict) -> dict:
    """Props for FloorLedger — every floor (top-down) with its category mix + units."""
    rooms = _active_rooms(model)
    apids = _active_package_ids(model)
    out = []
    for f in _floors_top_down(model):
        fr = _rooms_on(rooms, f["id"])
        out.append({
            "id": f["id"],
            "name": f["label"],
            "rooms": len(fr),
            "segments": _mix_segments(fr),
            "nameRange": _name_range(fr),
            "mapped": len(fr) > 0 and all(_is_mapped(r, apids) for r in fr),
            "units": [_typed_unit(r) for r in fr],
        })
    return {"floors": out}


def mapping_props(model: dict) -> dict:
    """Props for the mapping stage — packages + per-floor units (with current assignment)."""
    rooms = _active_rooms(model)
    packages = [
        {"id": p["id"], "name": p["name"]}
        for p in model.get("packages", [])
        if p.get("active", True)
    ]
    floors = []
    for f in _floors_top_down(model):
        fr = _rooms_on(rooms, f["id"])
        if not fr:
            continue
        floors.append({
            "floorId": f["id"],
            "floorLabel": f["label"],
            "units": [_mapping_unit(r) for r in fr],
        })
    return {"packages": packages, "floors": floors}


def unmapped_props(model: dict) -> dict:
    """Props for UnmappedWarning — floors with rooms not mapped to a live package."""
    rooms = _active_rooms(model)
    apids = _active_package_ids(model)
    out = []
    for f in _floors_top_down(model):
        unm = [r for r in _rooms_on(rooms, f["id"]) if not _is_mapped(r, apids)]
        if unm:
            out.append({
                "floorLabel": f["label"],
                "units": [_unit_base(r) for r in unm],
            })
    return {"floors": out}
