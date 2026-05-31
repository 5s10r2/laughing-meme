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
_UNIT_NOUN = {"room": "room", "flat": "flat", "bed": "bed"}


def _unit_noun(tree: SpaceTree) -> str:
    """Singular noun for the sellable unit, from the (uniform) rentable kind — so the UI
    says 'flat'/'bed' not always 'room'. Mixed or empty → the neutral 'unit'."""
    kinds = {u.kind for u in _all_rentable(tree)}
    return _UNIT_NOUN.get(next(iter(kinds)), "unit") if len(kinds) == 1 else "unit"


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
        "unitNoun": _unit_noun(tree),
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
    return {"floors": out, "unitNoun": _unit_noun(tree)}


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
    return {"packages": packages, "floors": floors, "unitNoun": _unit_noun(tree)}


def unmapped_props(tree: SpaceTree) -> dict:
    out = []
    for f in _floors_top_down(tree):
        unm = [u for u in _rentable_under(tree, f.id) if not _is_mapped(tree, u)]
        if unm:
            out.append({"floorLabel": f.label, "units": _unit_names(unm)})
    return {"floors": out, "unitNoun": _unit_noun(tree)}


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
    return {"packages": packages, "unitNoun": _unit_noun(tree)}


# =========================================================================== #
#  Blueprint registry + session-snapshot + live-context — the tree-path        #
#  counterparts of blueprint.py / ui_adapter, taking a model DICT (tree.       #
#  to_dict()) so they are drop-in for the server/agent (symmetric with the     #
#  legacy projections).                                                        #
# =========================================================================== #

from .domain.space_completeness import compute_completeness  # noqa: E402

_PROJECTIONS = {
    "MassingModel": massing_props,
    "FloorLedger": floor_ledger_props,
    "BlueprintMapping": mapping_props,
    "UnmappedWarning": unmapped_props,
    "PackagePanel": package_panel_props,
}
BLUEPRINT_COMPONENTS = frozenset(_PROJECTIONS)


def is_blueprint_component(component: str) -> bool:
    return component in _PROJECTIONS


def tree_blueprint_props(component: str, model: dict) -> dict | None:
    """Project a blueprint component's props from a tree model dict (rebuilds the tree).
    Returns None for non-blueprint components (caller falls back to Claude props)."""
    projection = _PROJECTIONS.get(component)
    return projection(SpaceTree.from_dict(model)) if projection else None


# facet order for the legacy stage bar — same as ui_adapter but with the tree's `offerings`.
_FACET_ORDER = (("property", "intro"), ("structure", "structure"),
                ("offerings", "packages"), ("mapping", "mapping"))


def tree_derive_stage(facets: dict) -> str:
    for facet, stage in _FACET_ORDER:
        if facets.get(facet) != "complete":
            return stage
    return "verification"


def _legacy_state_from_tree(tree: SpaceTree) -> dict:
    """A legacy OnboardingState-shaped projection (property identity + floors/units/packages)
    so anything in the frontend still reading `state` keeps working. The Blueprint itself
    refetches GET /model for the authoritative tree."""
    floors_td = _floors_top_down(tree)
    floor_index = {f.id: i for i, f in enumerate(reversed(floors_td))}
    units = []
    for f in floors_td:
        for u in _rentable_under(tree, f.id):
            units.append({
                "id": u.id, "name": u.label, "floor_index": floor_index.get(f.id, 0),
                "category": _unit_type(u), "sharing_type": u.sharing,
                "package_id": u.offering_id, "active": _active(u),
            })
    return {
        "user_name": tree.meta.get("owner_name"),
        "property_name": tree.meta.get("name"),
        "property_type": tree.meta.get("type"),
        "property_location": tree.meta.get("location"),
        "gender_preference": tree.meta.get("gender"),
        "floors": [{"index": i, "label": f.label, "active": _active(f)}
                   for i, f in enumerate(reversed(floors_td))],
        "units": units,
        "packages": package_panel_props(tree)["packages"],
    }


def tree_session_snapshot(snapshot: dict) -> dict:
    """Build the frontend's state_snapshot payload from a TreeCommandService snapshot."""
    tree = SpaceTree.from_dict(snapshot.get("model", {}))
    facets = snapshot.get("completeness", {}).get("facets", {})
    return {
        "state": _legacy_state_from_tree(tree),
        "stage": tree_derive_stage(facets),
        "stateVersion": snapshot.get("version", 0),
    }


_FACET_GLYPH = {"complete": "✓", "partial": "◐", "empty": "○"}


def tree_live_context(snapshot: dict) -> str:
    """Compact per-turn live block for the prompt, tree-aware (reads meta + tree facets/counts)."""
    model = snapshot.get("model", {})
    meta = model.get("meta", {})
    comp = snapshot.get("completeness", {})
    facets = comp.get("facets", {})
    counts = comp.get("counts", {})

    name = meta.get("name")
    if name:
        bits = [b for b in (meta.get("type"), meta.get("location")) if b]
        identity = f"{name}" + (f" ({', '.join(bits)})" if bits else "")
    else:
        identity = "new property — nothing captured yet"

    facet_line = " · ".join(
        f"{k} {_FACET_GLYPH.get(v, v)}"
        for k, v in (("property", facets.get("property")), ("structure", facets.get("structure")),
                     ("offerings", facets.get("offerings")), ("mapping", facets.get("mapping")))
        if v is not None
    )
    lines = [
        "## Current model (live)",
        f"Property: {identity}",
        f"Counts: {counts.get('rentable', 0)} units · {counts.get('rentable_mapped', 0)} mapped · "
        f"{counts.get('offerings', 0)} offerings",
    ]
    if facet_line:
        lines.append(f"Completeness: {facet_line}")
    open_items = comp.get("open_items") or []
    if open_items:
        lines.append("Still open before publish:")
        lines.extend(f"- {item}" for item in open_items)
    return "\n".join(lines)
