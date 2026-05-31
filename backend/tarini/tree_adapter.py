"""Tree adapter — projects a SpaceTree into the Living Blueprint component props.

The tree-native counterpart of ui_adapter's blueprint section: it emits the SAME prop
shapes (massing / floor_ledger / mapping / unmapped / package_panel) so the existing
frontend renders the recursive model with no changes. Generic over the tree:

  • a unit's "category" is its sharing (rooms) / config (flats) / kind (beds);
  • a floor's "units" are the rentable nodes anywhere in that floor's subtree;
  • the rentable kind drives the stat vocab (Rooms / Flats / Beds / Units).

Pure presentation — no colour (the frontend maps category → palette), no I/O. The model
stays the single source of truth.
"""
from __future__ import annotations

from .domain.space import SpaceTree
from .ui_adapter import _gender_label, _name_range, _type_label

_UNIT_LABEL = {"room": "Rooms", "flat": "Flats", "bed": "Beds"}


def _active(node) -> bool:
    return node.status == "active"


def _floors(tree: SpaceTree) -> list:
    return [s for s in tree.spaces.values() if s.kind == "floor" and _active(s)]


def _floors_top_down(tree: SpaceTree) -> list:
    return sorted(_floors(tree), key=lambda f: f.order, reverse=True)


def _blocks(tree: SpaceTree) -> list:
    return sorted((s for s in tree.spaces.values() if s.kind == "block"), key=lambda b: b.order)


def _all_rentable(tree: SpaceTree) -> list:
    return [s for s in tree.spaces.values() if s.rentable and _active(s)]


def _rentable_under(tree: SpaceTree, node_id: str) -> list:
    return [d for d in tree.descendants(node_id) if d.rentable and _active(d)]


def _unit_type(node) -> str:
    return node.sharing or node.config or node.kind


def _is_mapped(tree: SpaceTree, node) -> bool:
    """Mapped only if the node's offering exists AND is active — a dangling or disabled
    reference reads as unmapped (mirrors the frontend's isMapped)."""
    pid = node.offering_id
    off = tree.offerings.get(pid) if pid else None
    return bool(off) and off.active


def _mix_segments(units: list) -> list[dict]:
    order: list[str] = []
    counts: dict[str, int] = {}
    for u in units:
        t = _unit_type(u)
        if t not in counts:
            counts[t] = 0
            order.append(t)
        counts[t] += 1
    return [{"key": t, "label": t, "count": counts[t]} for t in order]


def _unit_names(units: list) -> list[dict]:
    return [{"id": u.id, "name": u.label} for u in units]


def massing_props(tree: SpaceTree) -> dict:
    floors = _floors(tree)
    rentable = _all_rentable(tree)
    blocks_src = _blocks(tree)

    per_block: dict[str, int] = {}
    for f in floors:
        per_block[f.parent_id] = per_block.get(f.parent_id, 0) + 1
    if blocks_src:
        blocks = [{"label": b.label, "floors": per_block.get(b.id, 0), "accentTop": i == 0}
                  for i, b in enumerate(blocks_src)]
    elif floors:
        blocks = [{"label": "Main", "floors": len(floors), "accentTop": True}]
    else:
        blocks = []

    kinds = {u.kind for u in rentable}
    unit_label = _UNIT_LABEL.get(next(iter(kinds)), "Units") if len(kinds) == 1 else "Units"
    types = {_unit_type(u) for u in rentable}

    kind = " ".join(b for b in (_gender_label(tree.meta.get("gender")),
                                _type_label(tree.meta.get("type"))) if b)
    meta_parts = [p for p in (kind or None, tree.meta.get("location")) if p]
    return {
        "propertyName": tree.meta.get("name") or "Your property",
        "owner": tree.meta.get("owner_name"),
        "meta": " · ".join(meta_parts),
        "blocks": blocks,
        "stats": [
            {"label": "Floors", "value": len(floors)},
            {"label": unit_label, "value": len(rentable)},
            {"label": "Types", "value": len(types)},
        ],
    }


def floor_ledger_props(tree: SpaceTree) -> dict:
    out = []
    for f in _floors_top_down(tree):
        units = _rentable_under(tree, f.id)
        out.append({
            "id": f.id,
            "name": f.label,
            "rooms": len(units),
            "segments": _mix_segments(units),
            "nameRange": _name_range([{"name": u.label} for u in units]),
            "mapped": bool(units) and all(_is_mapped(tree, u) for u in units),
            "units": [{"id": u.id, "name": u.label, "category": _unit_type(u)} for u in units],
        })
    return {"floors": out}


def mapping_props(tree: SpaceTree) -> dict:
    packages = [{"id": o.id, "name": o.name} for o in tree.offerings.values() if o.active]
    floors = []
    for f in _floors_top_down(tree):
        units = _rentable_under(tree, f.id)
        if not units:
            continue
        floors.append({
            "floorId": f.id,
            "floorLabel": f.label,
            "units": [{"id": u.id, "name": u.label, "category": _unit_type(u),
                       "packageId": u.offering_id} for u in units],
        })
    return {"packages": packages, "floors": floors}


def unmapped_props(tree: SpaceTree) -> dict:
    out = []
    for f in _floors_top_down(tree):
        unm = [u for u in _rentable_under(tree, f.id) if not _is_mapped(tree, u)]
        if unm:
            out.append({"floorLabel": f.label, "units": _unit_names(unm)})
    return {"floors": out}


def package_panel_props(tree: SpaceTree) -> dict:
    mapped_count: dict[str, int] = {}
    for u in _all_rentable(tree):
        if u.offering_id:
            mapped_count[u.offering_id] = mapped_count.get(u.offering_id, 0) + 1
    packages = [
        {
            "id": o.id, "name": o.name, "sharing": o.sharing, "ac": o.ac,
            "food": o.food or "none", "furnishing": o.furnishing, "rent": o.price,
            "amenities": list(o.amenities), "roomCount": mapped_count.get(o.id, 0),
        }
        for o in tree.offerings.values() if o.active
    ]
    return {"packages": packages}
