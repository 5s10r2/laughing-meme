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

    def __init__(self, spaces: dict[str, Space], root_id: str, id_gen: IdGen = _default_id_gen) -> None:
        self.spaces = spaces
        self.root_id = root_id
        self._id_gen = id_gen

    @classmethod
    def new(cls, label: str, id_gen: IdGen = _default_id_gen) -> "SpaceTree":
        root = Space(id=id_gen("prop"), kind="property", label=label, parent_id=None)
        return cls({root.id: root}, root.id, id_gen)

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
        node = Space(
            id=self._id_gen(kind),
            kind=kind,
            label=label,
            parent_id=parent_id,
            order=len(self.children(parent_id)),
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
        node.order = len(self.children(new_parent_id)) - 1  # appended; -1 since node now counted

    # ---- command entry point (mirrors Property.apply) ----
    def apply(self, command) -> object:
        """Apply one Space command, enforcing the tree's invariants. Returns the new/affected
        node(s) where useful. Unknown commands raise InvariantViolation (never a leaked error)."""
        import tarini.domain.space_commands as sc

        if isinstance(command, sc.AddSpaces):
            labels = command.labels or [str(i + 1) for i in range(command.count)]
            attrs: dict = {}
            if command.sharing is not None:
                attrs["sharing"] = command.sharing
                cap = capacity_for(command.sharing)
                if cap is not None:
                    attrs["capacity"] = cap
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
            for sid in command.space_ids:
                node = self.get(sid)
                node.sharing = command.sharing
                cap = capacity_for(command.sharing)
                if cap is not None:
                    node.capacity = cap
            return None

        if isinstance(command, sc.SetConfig):
            for sid in command.space_ids:
                self.get(sid).config = command.config
            return None

        if isinstance(command, sc.SetCapacity):
            for sid in command.space_ids:
                self.get(sid).capacity = command.capacity
            return None

        if isinstance(command, sc.MarkRentable):
            for sid in command.space_ids:
                self.get(sid).rentable = command.rentable
            return None

        if isinstance(command, sc.MarkUnavailable):
            for sid in command.space_ids:
                self.get(sid).status = "unavailable" if command.unavailable else "active"
            return None

        raise InvariantViolation(f"unknown space command {type(command).__name__}")
