"""Typed command intents — the only way the model is mutated.

Both the agent (`apply_commands`) and direct UI edits (`/commands`) emit these.
Pure data; immutable. Application logic lives on the Property aggregate (`property.apply`).
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SetProperty:
    owner_name: str | None = None
    name: str | None = None
    type: str | None = None
    location: str | None = None
    gender: str | None = None


@dataclass(frozen=True)
class AddFloors:
    """Add floors. Provide explicit `labels`, or a `count` (auto-labelled from `start_index`)."""
    labels: list[str] | None = None
    count: int | None = None
    start_index: int = 0
    block_id: str | None = None  # defaults to the primary block


@dataclass(frozen=True)
class RenameFloor:
    floor_id: str
    label: str


@dataclass(frozen=True)
class RemoveFloor:
    floor_id: str


@dataclass(frozen=True)
class SetFloorRooms:
    """Set the room count on a floor. Optional `type_mix` maps category -> count."""
    floor_id: str
    count: int
    type_mix: dict[str, int] | None = None


@dataclass(frozen=True)
class SetRoomType:
    room_ids: list[str]
    category: str
    sharing: str | None = None


@dataclass(frozen=True)
class RenameRoom:
    room_id: str
    name: str


@dataclass(frozen=True)
class SetNamingPattern:
    scope: str  # "all" or a floor_id
    pattern: str  # e.g. "{floor}{nn}"
    start: int = 1


@dataclass(frozen=True)
class CreatePackage:
    name: str
    sharing: str | None = None
    ac: bool = False
    food: str = "none"  # none | included | optional
    furnishing: str | None = None
    rent: int | None = None
    amenities: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class UpdatePackage:
    package_id: str
    name: str | None = None
    sharing: str | None = None
    ac: bool | None = None
    food: str | None = None
    furnishing: str | None = None
    rent: int | None = None
    amenities: list[str] | None = None


@dataclass(frozen=True)
class DisablePackage:
    package_id: str


@dataclass(frozen=True)
class DeletePackage:
    package_id: str


@dataclass(frozen=True)
class MapRooms:
    room_ids: list[str]
    package_id: str


@dataclass(frozen=True)
class UnmapRooms:
    room_ids: list[str]


@dataclass(frozen=True)
class MarkUnavailable:
    room_ids: list[str]


@dataclass(frozen=True)
class Publish:
    pass


Command = (
    SetProperty | AddFloors | RenameFloor | RemoveFloor | SetFloorRooms | SetRoomType
    | RenameRoom | SetNamingPattern | CreatePackage | UpdatePackage | DisablePackage
    | DeletePackage | MapRooms | UnmapRooms | MarkUnavailable | Publish
)
