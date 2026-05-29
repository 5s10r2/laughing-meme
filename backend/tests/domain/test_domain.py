"""Domain core tests — pure, fast. Deterministic IDs via a counter id_gen."""
import pytest

from tarini.domain import commands as c
from tarini.domain import compute_completeness
from tarini.domain.errors import InvariantViolation, NotFound, PublishBlocked
from tarini.domain.property import Property


def counter_id_gen():
    counts: dict[str, int] = {}

    def gen(prefix: str) -> str:
        counts[prefix] = counts.get(prefix, 0) + 1
        return f"{prefix}{counts[prefix]}"

    return gen


def fresh() -> Property:
    return Property(id_gen=counter_id_gen())


# --------------------------------------------------------------------------- property
def test_set_property():
    p = fresh()
    p.apply(c.SetProperty(name="Sunrise PG", type="pg", location="Koramangala"))
    assert p.name == "Sunrise PG" and p.type == "pg" and p.location == "Koramangala"
    # partial update doesn't clobber
    p.apply(c.SetProperty(gender="coed"))
    assert p.name == "Sunrise PG" and p.gender == "coed"


# --------------------------------------------------------------------------- structure
def test_add_floors_count_and_labels():
    p = fresh()
    p.apply(c.AddFloors(count=2))
    assert [f.index for f in p.floors] == [0, 1]
    p.apply(c.AddFloors(labels=["Terrace"]))
    assert p.floors[-1].label == "Terrace" and p.floors[-1].index == 2


def test_add_floors_requires_input():
    p = fresh()
    with pytest.raises(InvariantViolation):
        p.apply(c.AddFloors())


def test_set_floor_rooms_creates_named_rooms():
    p = fresh()
    p.apply(c.AddFloors(count=1))
    fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=3))
    rooms = p.rooms_on_floor(fid)
    assert len(rooms) == 3
    # default naming "{floor}{nn}" with floor index 0, start 1 -> 001, 002, 003
    assert [r.name for r in rooms] == ["001", "002", "003"]


def test_set_floor_rooms_preserves_mappings_on_resize():
    p = fresh()
    p.apply(c.AddFloors(count=1))
    fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=3))
    p.apply(c.CreatePackage(name="Std", rent=8000))
    pid = p.packages[0].id
    first_room = p.rooms_on_floor(fid)[0].id
    p.apply(c.MapRooms(room_ids=[first_room], package_id=pid))
    p.apply(c.SetFloorRooms(floor_id=fid, count=5))  # grow
    assert p.room(first_room).package_id == pid  # mapping preserved
    assert len(p.rooms_on_floor(fid)) == 5


def test_set_floor_rooms_type_mix():
    p = fresh()
    p.apply(c.AddFloors(count=1))
    fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=4, type_mix={"single": 3, "double": 1}))
    cats = sorted(r.category for r in p.rooms_on_floor(fid))
    assert cats == ["double", "single", "single", "single"]


def test_naming_pattern_regenerates():
    p = fresh()
    p.apply(c.AddFloors(count=1))  # index 0
    fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=2))
    p.apply(c.SetNamingPattern(scope="all", pattern="G-{nn}", start=1))
    assert [r.name for r in p.rooms_on_floor(fid)] == ["G-01", "G-02"]


def test_remove_floor_cascades():
    p = fresh()
    p.apply(c.AddFloors(count=2))
    fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=2))
    p.apply(c.RemoveFloor(floor_id=fid))
    assert len(p.floors) == 1 and p.rooms_on_floor(fid) == []


# --------------------------------------------------------------------------- packages
def test_create_package_rent_warning_and_duplicate():
    p = fresh()
    warns = p.apply(c.CreatePackage(name="AC Double"))
    assert any("rent" in w for w in warns)
    with pytest.raises(InvariantViolation):
        p.apply(c.CreatePackage(name="ac double"))  # case-insensitive dup


def test_delete_package_guarded_when_mapped():
    p = fresh()
    p.apply(c.AddFloors(count=1)); fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=1))
    p.apply(c.CreatePackage(name="Std", rent=7000)); pid = p.packages[0].id
    p.apply(c.MapRooms(room_ids=[p.rooms_on_floor(fid)[0].id], package_id=pid))
    with pytest.raises(InvariantViolation):
        p.apply(c.DeletePackage(package_id=pid))


def test_map_to_disabled_package_blocked():
    p = fresh()
    p.apply(c.AddFloors(count=1)); fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=1))
    p.apply(c.CreatePackage(name="Std", rent=7000)); pid = p.packages[0].id
    p.apply(c.DisablePackage(package_id=pid))
    with pytest.raises(InvariantViolation):
        p.apply(c.MapRooms(room_ids=[p.rooms_on_floor(fid)[0].id], package_id=pid))


def test_unknown_room_raises():
    p = fresh()
    with pytest.raises(NotFound):
        p.apply(c.RenameRoom(room_id="nope", name="x"))


# --------------------------------------------------------------------------- publish + completeness
def _publishable(p: Property) -> Property:
    p.apply(c.SetProperty(name="Sunrise PG", type="pg", location="Koramangala"))
    p.apply(c.AddFloors(count=1)); fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=2))
    p.apply(c.CreatePackage(name="Std", rent=8000)); pid = p.packages[0].id
    p.apply(c.MapRooms(room_ids=[r.id for r in p.rooms_on_floor(fid)], package_id=pid))
    return p


def test_publish_blocked_then_ok():
    p = fresh()
    with pytest.raises(PublishBlocked) as ei:
        p.apply(c.Publish())
    assert ei.value.open_items  # has reasons
    _publishable(p)
    assert p.apply(c.Publish()) == []  # no error, no warnings


def test_completeness_progression():
    p = fresh()
    assert compute_completeness(p)["facets"]["structure"] == "empty"
    _publishable(p)
    comp = compute_completeness(p)
    assert comp["publishable"] is True
    assert comp["facets"] == {
        "property": "complete", "structure": "complete",
        "packages": "complete", "mapping": "complete",
    }
    assert comp["counts"]["rooms_mapped"] == 2


def test_partial_completeness_when_unmapped():
    p = fresh()
    p.apply(c.SetProperty(name="X", type="pg", location="Y"))
    p.apply(c.AddFloors(count=1)); fid = p.floors[0].id
    p.apply(c.SetFloorRooms(floor_id=fid, count=2))
    p.apply(c.CreatePackage(name="Std", rent=8000)); pid = p.packages[0].id
    p.apply(c.MapRooms(room_ids=[p.rooms_on_floor(fid)[0].id], package_id=pid))  # only 1 of 2
    comp = compute_completeness(p)
    assert comp["facets"]["mapping"] == "partial"
    assert comp["publishable"] is False


# --------------------------------------------------------------------------- serialization
def test_serialization_round_trip():
    p = _publishable(fresh())
    data = p.to_dict()
    p2 = Property.from_dict(data)
    assert p2.to_dict() == data
    assert compute_completeness(p2)["publishable"] is True
