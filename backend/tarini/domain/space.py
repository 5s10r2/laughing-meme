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
