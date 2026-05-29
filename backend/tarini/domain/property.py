"""The Property aggregate — the single source of truth for a property model.

Pure domain: no I/O, no framework imports. The aggregate owns its invariants; the only
way to mutate it is `apply(command)`. Application code wraps this with persistence/versioning.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from typing import Callable

from . import commands as c
from .errors import InvariantViolation, NotFound, PublishBlocked
from .invariants import publish_open_items

IdGen = Callable[[str], str]


def _default_id_gen(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# --------------------------------------------------------------------------- entities
@dataclass
class Block:
    id: str
    label: str


@dataclass
class Floor:
    id: str
    block_id: str
    index: int
    label: str
    active: bool = True


@dataclass
class Room:
    id: str
    floor_id: str
    name: str
    category: str = "room"
    sharing: str | None = None
    package_id: str | None = None
    status: str = "active"  # active | unavailable


@dataclass
class Package:
    id: str
    name: str
    sharing: str | None = None
    ac: bool = False
    food: str = "none"
    furnishing: str | None = None
    rent: int | None = None
    amenities: list[str] = field(default_factory=list)
    active: bool = True


@dataclass
class NamingPattern:
    pattern: str = "{floor}{nn}"
    start: int = 1


_DEFAULT_NAMING = NamingPattern()


def _render_name(pattern: str, floor_index: int, seq: int) -> str:
    return (
        pattern.replace("{floor}", str(floor_index))
        .replace("{nn}", f"{seq:02d}")
        .replace("{n}", str(seq))
    )


# --------------------------------------------------------------------------- aggregate
class Property:
    def __init__(self, id_gen: IdGen = _default_id_gen) -> None:
        self.owner_name: str | None = None
        self.name: str | None = None
        self.type: str | None = None
        self.location: str | None = None
        self.gender: str | None = None
        self.blocks: list[Block] = []
        self.floors: list[Floor] = []
        self.rooms: list[Room] = []
        self.packages: list[Package] = []
        self.naming: dict[str, NamingPattern] = {}
        self.version: int = 0
        self._id_gen = id_gen

    # ---- lookups ----
    def _primary_block(self) -> Block:
        if not self.blocks:
            self.blocks.append(Block(id=self._id_gen("blk"), label="Main"))
        return self.blocks[0]

    def floor(self, floor_id: str) -> Floor:
        for f in self.floors:
            if f.id == floor_id:
                return f
        raise NotFound(f"Floor {floor_id} not found")

    def room(self, room_id: str) -> Room:
        for r in self.rooms:
            if r.id == room_id:
                return r
        raise NotFound(f"Room {room_id} not found")

    def package(self, package_id: str) -> Package:
        for p in self.packages:
            if p.id == package_id:
                return p
        raise NotFound(f"Package {package_id} not found")

    def rooms_on_floor(self, floor_id: str) -> list[Room]:
        return [r for r in self.rooms if r.floor_id == floor_id]

    def _naming_for(self, floor_id: str) -> NamingPattern:
        return self.naming.get(floor_id) or self.naming.get("all") or _DEFAULT_NAMING

    def _regen_names(self, floor_id: str) -> None:
        fl = self.floor(floor_id)
        np = self._naming_for(floor_id)
        for seq, r in enumerate(self.rooms_on_floor(floor_id), start=np.start):
            r.name = _render_name(np.pattern, fl.index, seq)

    # ---- command application (the only mutation path) ----
    def apply(self, cmd: c.Command) -> list[str]:
        """Apply one command, enforcing invariants. Returns non-fatal warnings."""
        match cmd:
            case c.SetProperty():
                return self._set_property(cmd)
            case c.AddFloors():
                return self._add_floors(cmd)
            case c.RenameFloor():
                self.floor(cmd.floor_id).label = cmd.label
            case c.RemoveFloor():
                return self._remove_floor(cmd)
            case c.SetFloorRooms():
                return self._set_floor_rooms(cmd)
            case c.SetRoomType():
                for rid in cmd.room_ids:
                    r = self.room(rid)
                    r.category = cmd.category
                    r.sharing = cmd.sharing
            case c.RenameRoom():
                self.room(cmd.room_id).name = cmd.name
            case c.SetNamingPattern():
                self.naming[cmd.scope] = NamingPattern(cmd.pattern, cmd.start)
                targets = self.floors if cmd.scope == "all" else [self.floor(cmd.scope)]
                for fl in targets:
                    self._regen_names(fl.id)
            case c.CreatePackage():
                return self._create_package(cmd)
            case c.UpdatePackage():
                return self._update_package(cmd)
            case c.DisablePackage():
                self.package(cmd.package_id).active = False
            case c.DeletePackage():
                return self._delete_package(cmd)
            case c.MapRooms():
                return self._map_rooms(cmd)
            case c.UnmapRooms():
                for rid in cmd.room_ids:
                    self.room(rid).package_id = None
            case c.MarkUnavailable():
                for rid in cmd.room_ids:
                    self.room(rid).status = "unavailable"
            case c.Publish():
                items = publish_open_items(self)
                if items:
                    raise PublishBlocked(items)
            case _:
                raise InvariantViolation(f"Unknown command: {type(cmd).__name__}")
        return []

    # ---- handlers ----
    def _set_property(self, cmd: c.SetProperty) -> list[str]:
        for f_ in ("owner_name", "name", "type", "location", "gender"):
            v = getattr(cmd, f_)
            if v is not None:
                setattr(self, f_, v)
        return []

    def _add_floors(self, cmd: c.AddFloors) -> list[str]:
        block_id = cmd.block_id or self._primary_block().id
        if cmd.labels is not None:
            labels = cmd.labels
        elif cmd.count is not None:
            labels = [f"Floor {cmd.start_index + i}" for i in range(cmd.count)]
        else:
            raise InvariantViolation("AddFloors needs `labels` or `count`")
        next_index = (max((f.index for f in self.floors), default=-1)) + 1
        for i, label in enumerate(labels):
            self.floors.append(
                Floor(id=self._id_gen("flr"), block_id=block_id, index=next_index + i, label=label)
            )
        return []

    def _remove_floor(self, cmd: c.RemoveFloor) -> list[str]:
        fl = self.floor(cmd.floor_id)
        mapped = [r for r in self.rooms_on_floor(fl.id) if r.package_id]
        self.rooms = [r for r in self.rooms if r.floor_id != fl.id]
        self.floors = [f for f in self.floors if f.id != fl.id]
        self.naming.pop(fl.id, None)
        return [f"Removed {len(mapped)} mapped rooms with the floor"] if mapped else []

    def _set_floor_rooms(self, cmd: c.SetFloorRooms) -> list[str]:
        fl = self.floor(cmd.floor_id)
        if cmd.count < 0:
            raise InvariantViolation("Room count cannot be negative")
        existing = self.rooms_on_floor(fl.id)
        # preserve up to count (keeps ids/mappings/status), then add/remove the difference
        keep = existing[: cmd.count]
        for r in existing[cmd.count:]:
            self.rooms.remove(r)
        for _ in range(cmd.count - len(existing)):
            keep.append(
                Room(id=self._id_gen("rm"), floor_id=fl.id, name="")
            )
        # ensure new rooms are in self.rooms
        for r in keep:
            if r not in self.rooms:
                self.rooms.append(r)
        if cmd.type_mix:
            seq = 0
            ordered = self.rooms_on_floor(fl.id)
            for category, n in cmd.type_mix.items():
                for _ in range(n):
                    if seq < len(ordered):
                        ordered[seq].category = category
                        seq += 1
        self._regen_names(fl.id)
        warn = []
        if cmd.type_mix and sum(cmd.type_mix.values()) != cmd.count:
            warn.append("type_mix total does not match room count")
        return warn

    def _create_package(self, cmd: c.CreatePackage) -> list[str]:
        if any(p.name.lower() == cmd.name.lower() and p.active for p in self.packages):
            raise InvariantViolation(f"A package named '{cmd.name}' already exists")
        self.packages.append(
            Package(
                id=self._id_gen("pkg"), name=cmd.name, sharing=cmd.sharing, ac=cmd.ac,
                food=cmd.food, furnishing=cmd.furnishing, rent=cmd.rent,
                amenities=list(cmd.amenities),
            )
        )
        return [] if cmd.rent is not None else ["Package has no rent yet — required before publish"]

    def _update_package(self, cmd: c.UpdatePackage) -> list[str]:
        p = self.package(cmd.package_id)
        for f_ in ("name", "sharing", "ac", "food", "furnishing", "rent", "amenities"):
            v = getattr(cmd, f_)
            if v is not None:
                setattr(p, f_, v)
        return []

    def _delete_package(self, cmd: c.DeletePackage) -> list[str]:
        mapped = [r for r in self.rooms if r.package_id == cmd.package_id]
        if mapped:
            raise InvariantViolation(
                f"Cannot delete a package mapped to {len(mapped)} rooms — remap or disable first"
            )
        self.packages = [p for p in self.packages if p.id != cmd.package_id]
        return []

    def _map_rooms(self, cmd: c.MapRooms) -> list[str]:
        pkg = self.package(cmd.package_id)
        if not pkg.active:
            raise InvariantViolation("Cannot map rooms to a disabled package")
        for rid in cmd.room_ids:
            self.room(rid).package_id = pkg.id
        return []

    # ---- serialization (for the repository adapter) ----
    def to_dict(self) -> dict:
        return {
            "owner_name": self.owner_name, "name": self.name, "type": self.type,
            "location": self.location, "gender": self.gender,
            "blocks": [asdict(b) for b in self.blocks],
            "floors": [asdict(f) for f in self.floors],
            "rooms": [asdict(r) for r in self.rooms],
            "packages": [asdict(p) for p in self.packages],
            "naming": {k: asdict(v) for k, v in self.naming.items()},
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict, id_gen: IdGen = _default_id_gen) -> "Property":
        p = cls(id_gen=id_gen)
        for f_ in ("owner_name", "name", "type", "location", "gender"):
            setattr(p, f_, data.get(f_))
        p.blocks = [Block(**b) for b in data.get("blocks", [])]
        p.floors = [Floor(**f) for f in data.get("floors", [])]
        p.rooms = [Room(**r) for r in data.get("rooms", [])]
        p.packages = [Package(**pk) for pk in data.get("packages", [])]
        p.naming = {k: NamingPattern(**v) for k, v in data.get("naming", {}).items()}
        p.version = data.get("version", 0)
        return p
