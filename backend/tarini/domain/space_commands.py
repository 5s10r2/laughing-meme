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


# ---- offerings (curated priced templates) ----
@dataclass(frozen=True)
class CreateOffering:
    name: str
    price: int | None = None
    billing_basis: str = "per_bed"
    billing_period: str = "monthly"
    attrs: dict | None = None  # curated, catalog-validated (see domain.offering)


@dataclass(frozen=True)
class UpdateOffering:
    offering_id: str
    name: str | None = None
    price: int | None = None
    billing_basis: str | None = None
    billing_period: str | None = None
    attrs: dict | None = None  # partial; only listed keys change


@dataclass(frozen=True)
class DisableOffering:
    offering_id: str


@dataclass(frozen=True)
class DeleteOffering:
    offering_id: str


@dataclass(frozen=True)
class MapOffering:
    space_ids: list[str]
    offering_id: str


@dataclass(frozen=True)
class UnmapOffering:
    space_ids: list[str]
