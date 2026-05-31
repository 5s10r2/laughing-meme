"""The uniform Space-tree command vocabulary.

One set of structural commands for the whole recursive tree — replacing the legacy
AddFloors / SetFloorRooms / RenameRoom / RenameFloor / RemoveFloor / SetRoomType /
MapRooms. Frozen dataclasses (mirrors `domain.commands`); applied via `SpaceTree.apply`.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AddSpaces:
    parent_id: str
    kind: str
    count: int = 1
    labels: list[str] | None = None       # explicit labels; else auto "1".."N"
    sharing: str | None = None            # for rooms (→ capacity)
    config: str | None = None             # for flats/units


@dataclass(frozen=True)
class RenameSpace:
    space_id: str
    label: str


@dataclass(frozen=True)
class RemoveSpace:
    space_id: str


@dataclass(frozen=True)
class MoveSpace:
    space_id: str
    new_parent_id: str


@dataclass(frozen=True)
class SetSharing:
    space_ids: list[str]
    sharing: str


@dataclass(frozen=True)
class SetConfig:
    space_ids: list[str]
    config: str


@dataclass(frozen=True)
class SetCapacity:
    space_ids: list[str]
    capacity: int


@dataclass(frozen=True)
class MarkRentable:
    space_ids: list[str]
    rentable: bool = True


@dataclass(frozen=True)
class MarkUnavailable:
    space_ids: list[str]
    unavailable: bool = True
