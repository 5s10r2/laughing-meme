"""The Space tree — the recursive inventory aggregate.

A single node type (`Space`) nests by a validated **containment grammar**: kinds are
ranked `property < block < floor < flat < room < bed`, and a node may contain only
children of *strictly higher* rank. So levels are freely skippable but never inverted —
a PG (shallow: property → room) and an apartment building (deep: property → floor →
flat → room → bed) are the same tree at different depths.

Pure domain: no I/O, no framework imports. `sharing` on a room is its capacity (beds);
beds are materialised as nodes only for the rare per-bed case.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Callable

from .errors import InvariantViolation, NotFound

IdGen = Callable[[str], str]


def _default_id_gen(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# Containment grammar: a node may contain children of STRICTLY higher rank.
KIND_RANK: dict[str, int] = {
    "property": 0,
    "block": 1,
    "floor": 2,
    "flat": 3,
    "room": 4,
    "bed": 5,
}
KINDS = tuple(KIND_RANK)


def can_contain(parent_kind: str, child_kind: str) -> bool:
    """True if a node of `parent_kind` may contain a child of `child_kind`."""
    if parent_kind not in KIND_RANK or child_kind not in KIND_RANK:
        return False
    return KIND_RANK[child_kind] > KIND_RANK[parent_kind]


# A room's sharing IS its capacity (beds = max tenants). Dormitory/unknown → explicit count.
_SHARING_CAPACITY: dict[str, int] = {"single": 1, "double": 2, "triple": 3, "quad": 4}


def capacity_for(sharing: str | None) -> int | None:
    """Beds a room holds, derived from its sharing. None when it needs an explicit count
    (dormitory) or is unknown."""
    return _SHARING_CAPACITY.get(sharing or "")


# Only sellable units carry a price/availability; containers never do.
RENTABLE_KINDS = frozenset({"flat", "room", "bed"})


def _check_sharing(sharing: str | None) -> None:
    from .offering import SHARINGS  # single source of truth for the catalog

    if sharing is not None and sharing not in SHARINGS:
        raise InvariantViolation(f"unknown sharing {sharing!r}")


def _check_config(config: str | None) -> None:
    from .offering import CONFIGS

    if config is not None and config not in CONFIGS:
        raise InvariantViolation(f"unknown config {config!r}")


@dataclass
class Space:
    id: str
    kind: str
    label: str
    parent_id: str | None = None
    order: int = 0
    status: str = "active"  # active | unavailable
    # capacity (rooms/units that hold tenants):
    sharing: str | None = None  # single|double|triple|quad|dormitory — a room's bed count
    config: str | None = None   # rk|studio|1bhk|… — a flat/unit
    capacity: int | None = None  # tenants/beds; derived from sharing, explicit for dorms
    # selling:
    rentable: bool = False
    offering_id: str | None = None


class SpaceTree:
    """A tree of `Space` nodes rooted at a single `property`. Mutations enforce the
    containment grammar; the aggregate owns its structural invariants."""

    def __init__(
        self,
        spaces: dict[str, Space],
        root_id: str,
        id_gen: IdGen = _default_id_gen,
        offerings: dict | None = None,
    ) -> None:
        self.spaces = spaces
        self.root_id = root_id
        self._id_gen = id_gen
        self.offerings: dict = offerings if offerings is not None else {}
        self.meta: dict = {}      # property-level: owner_name, type, location, gender
        self.version: int = 0

    @classmethod
    def new(cls, label: str, id_gen: IdGen = _default_id_gen) -> "SpaceTree":
        root = Space(id=id_gen("prop"), kind="property", label=label, parent_id=None)
        return cls({root.id: root}, root.id, id_gen)

    def get_offering(self, offering_id: str):
        off = self.offerings.get(offering_id)
        if off is None:
            raise NotFound(f"no offering {offering_id!r}")
        return off

    # ---- persistence ----
    def to_dict(self) -> dict:
        from dataclasses import asdict

        return {
            "root_id": self.root_id,
            "meta": dict(self.meta),
            "version": self.version,
            "spaces": [asdict(s) for s in self.spaces.values()],
            "offerings": [asdict(o) for o in self.offerings.values()],
        }

    @classmethod
    def from_dict(cls, data: dict, id_gen: IdGen = _default_id_gen) -> "SpaceTree":
        from .offering import Offering

        spaces = {s["id"]: Space(**s) for s in data.get("spaces", [])}
        offerings = {o["id"]: Offering(**o) for o in data.get("offerings", [])}
        tree = cls(spaces, data["root_id"], id_gen, offerings)
        tree.meta = dict(data.get("meta", {}))
        tree.version = data.get("version", 0)
        return tree

    @classmethod
    def from_legacy(cls, data: dict, id_gen: IdGen = _default_id_gen) -> "SpaceTree":
        """Convert a stored legacy Property snapshot (blocks/floors/rooms/packages) into the
        recursive tree. A single block collapses away; multiple blocks are preserved; packages
        become offerings; room↔package links carry over. Lossless for the live PG model."""
        from .offering import Offering

        tree = cls.new(data.get("name") or "Property", id_gen)
        tree.meta = {k: data.get(k) for k in ("name", "owner_name", "type", "location", "gender")}
        tree.version = data.get("version", 0)

        # packages → offerings (constructed directly: migrating existing data, not new input)
        pkg_to_offering: dict[str, str] = {}
        for pk in data.get("packages", []):
            attrs = {k: pk[k] for k in ("sharing", "furnishing", "food", "amenities") if pk.get(k)}
            off = Offering(
                id=id_gen("off"),
                name=pk.get("name") or "Package",
                price=pk.get("rent"),
                billing_basis="per_bed",
                billing_period="monthly",
                active=pk.get("active", True),
                ac=pk.get("ac", False),
                **attrs,
            )
            tree.offerings[off.id] = off
            pkg_to_offering[pk["id"]] = off.id

        # blocks: a single block collapses into the property root
        blocks = data.get("blocks", [])
        multi_block = len(blocks) > 1
        block_parent: dict[str, str] = {}
        for b in blocks:
            if multi_block:
                block_parent[b["id"]] = tree.add(tree.root_id, "block", b["label"]).id
            else:
                block_parent[b["id"]] = tree.root_id

        # floors (ordered by their legacy index)
        floor_node: dict[str, str] = {}
        for f in sorted(data.get("floors", []), key=lambda f: f.get("index", 0)):
            parent = block_parent.get(f.get("block_id"), tree.root_id)
            node = tree.add(parent, "floor", f["label"])
            node.status = "active" if f.get("active", True) else "unavailable"
            floor_node[f["id"]] = node.id

        # rooms
        for r in data.get("rooms", []):
            # orphan room (floor missing) → attach to the property root rather than drop it
            parent = floor_node.get(r.get("floor_id")) or tree.root_id
            node = tree.add(parent, "room", r.get("name") or "")
            node.status = r.get("status", "active")
            node.rentable = True  # every PG room is a sellable unit, mapped or not
            sharing = r.get("sharing")
            if sharing:
                node.sharing = sharing
                # derive from sharing; fall back to an explicit legacy count for dorms if present
                node.capacity = capacity_for(sharing) or r.get("capacity") or r.get("beds")
            pid = r.get("package_id")
            if pid and pid in pkg_to_offering:
                node.offering_id = pkg_to_offering[pid]

        return tree

    # ---- reads ----
    def root(self) -> Space:
        return self.spaces[self.root_id]

    def get(self, space_id: str) -> Space:
        node = self.spaces.get(space_id)
        if node is None:
            raise NotFound(f"no space {space_id!r}")
        return node

    def children(self, parent_id: str) -> list[Space]:
        kids = [s for s in self.spaces.values() if s.parent_id == parent_id]
        return sorted(kids, key=lambda s: (s.order, s.id))

    def descendants(self, space_id: str) -> list[Space]:
        out: list[Space] = []
        for child in self.children(space_id):
            out.append(child)
            out.extend(self.descendants(child.id))
        return out

    # ---- mutations ----
    def add(self, parent_id: str, kind: str, label: str, **attrs) -> Space:
        parent = self.get(parent_id)  # NotFound if missing
        if kind not in KIND_RANK:
            raise InvariantViolation(f"unknown space kind {kind!r}")
        if not can_contain(parent.kind, kind):
            raise InvariantViolation(f"a {parent.kind} cannot contain a {kind}")
        kids = self.children(parent_id)
        node = Space(
            id=self._id_gen(kind),
            kind=kind,
            label=label,
            parent_id=parent_id,
            order=max((k.order for k in kids), default=-1) + 1,  # append; survives gaps from removes
            **attrs,
        )
        self.spaces[node.id] = node
        return node

    def remove(self, space_id: str) -> None:
        if space_id == self.root_id:
            raise InvariantViolation("cannot remove the property root")
        node = self.get(space_id)
        for desc in self.descendants(space_id):
            del self.spaces[desc.id]
        del self.spaces[node.id]

    def move(self, space_id: str, new_parent_id: str) -> None:
        if space_id == self.root_id:
            raise InvariantViolation("cannot move the property root")
        node = self.get(space_id)
        new_parent = self.get(new_parent_id)
        if new_parent_id == space_id or any(d.id == new_parent_id for d in self.descendants(space_id)):
            raise InvariantViolation("cannot move a space into itself or its own descendant")
        if not can_contain(new_parent.kind, node.kind):
            raise InvariantViolation(f"a {new_parent.kind} cannot contain a {node.kind}")
        node.parent_id = new_parent_id
        siblings = [s for s in self.children(new_parent_id) if s.id != space_id]
        node.order = max((s.order for s in siblings), default=-1) + 1  # append after existing

    # ---- command entry point (mirrors Property.apply) ----
    def apply(self, command) -> object:
        """Apply one Space command, enforcing the tree's invariants. Returns the new/affected
        node(s) where useful. Unknown commands raise InvariantViolation (never a leaked error)."""
        import tarini.domain.space_commands as sc

        if isinstance(command, sc.AddSpaces):
            labels = command.labels or [str(i + 1) for i in range(command.count)]
            if not labels:
                raise InvariantViolation("AddSpaces needs at least one label or count >= 1")
            _check_sharing(command.sharing)
            _check_config(command.config)
            attrs: dict = {}
            if command.sharing is not None:
                attrs["sharing"] = command.sharing
                attrs["capacity"] = capacity_for(command.sharing)  # None for dorm → set explicitly
            if command.config is not None:
                attrs["config"] = command.config
            return [self.add(command.parent_id, command.kind, label, **attrs) for label in labels]

        if isinstance(command, sc.RenameSpace):
            self.get(command.space_id).label = command.label
            return None

        if isinstance(command, sc.RemoveSpace):
            self.remove(command.space_id)
            return None

        if isinstance(command, sc.MoveSpace):
            self.move(command.space_id, command.new_parent_id)
            return None

        if isinstance(command, sc.SetSharing):
            _check_sharing(command.sharing)
            for sid in command.space_ids:
                node = self.get(sid)
                node.sharing = command.sharing
                node.capacity = capacity_for(command.sharing)  # clears for dorm (needs explicit)
            return None

        if isinstance(command, sc.SetConfig):
            _check_config(command.config)
            for sid in command.space_ids:
                self.get(sid).config = command.config
            return None

        if isinstance(command, sc.SetCapacity):
            for sid in command.space_ids:
                node = self.get(sid)
                if node.kind not in RENTABLE_KINDS:
                    raise InvariantViolation(f"a {node.kind} cannot carry a capacity")
                node.capacity = command.capacity
            return None

        if isinstance(command, sc.MarkRentable):
            for sid in command.space_ids:
                node = self.get(sid)
                if command.rentable and node.kind not in RENTABLE_KINDS:
                    raise InvariantViolation(f"a {node.kind} is a container, not a sellable unit")
                node.rentable = command.rentable
            return None

        if isinstance(command, sc.MarkUnavailable):
            for sid in command.space_ids:
                self.get(sid).status = "unavailable" if command.unavailable else "active"
            return None

        # ---- offerings ----
        if isinstance(command, sc.CreateOffering):
            from .offering import Offering, validate_attrs, validate_billing

            validate_billing(command.billing_basis, command.billing_period)
            attrs = validate_attrs(command.attrs or {})  # returns a copy — no aliasing
            off = Offering(
                id=self._id_gen("off"),
                name=command.name,
                price=command.price,
                billing_basis=command.billing_basis,
                billing_period=command.billing_period,
                **attrs,
            )
            self.offerings[off.id] = off
            return off

        if isinstance(command, sc.UpdateOffering):
            from .offering import validate_attrs, validate_billing

            off = self.get_offering(command.offering_id)
            validate_billing(command.billing_basis, command.billing_period)
            safe_attrs = validate_attrs(command.attrs or {})  # returns a copy — no aliasing
            if command.name is not None:
                off.name = command.name
            if command.price is not None:
                off.price = command.price
            if command.billing_basis is not None:
                off.billing_basis = command.billing_basis
            if command.billing_period is not None:
                off.billing_period = command.billing_period
            for key, value in safe_attrs.items():
                setattr(off, key, value)
            return off

        if isinstance(command, sc.DisableOffering):
            self.get_offering(command.offering_id).active = False
            return None

        if isinstance(command, sc.DeleteOffering):
            self.get_offering(command.offering_id)  # NotFound if missing
            if any(s.offering_id == command.offering_id for s in self.spaces.values()):
                raise InvariantViolation("cannot delete an offering that is still mapped")
            del self.offerings[command.offering_id]
            return None

        if isinstance(command, sc.MapOffering):
            self.get_offering(command.offering_id)  # NotFound if missing
            nodes = [self.get(sid) for sid in command.space_ids]  # NotFound if any missing
            for node in nodes:
                node.offering_id = command.offering_id
            return None

        if isinstance(command, sc.UnmapOffering):
            for sid in command.space_ids:
                self.get(sid).offering_id = None
            return None

        raise InvariantViolation(f"unknown space command {type(command).__name__}")
