"""Offerings — curated, fully-structured priced templates.

An Offering is what a tenant actually buys: a price + billing terms + a set of
categorical attributes (sharing, config, furnishing, food, amenities, …). Every
categorical value is validated against a fixed catalog — there is NO free text — so
the resulting listings stay filterable and the data stays sane. Offerings are mapped
onto rentable Space nodes; one offering can cover many nodes.

Pure domain: no I/O. Validation raises InvariantViolation on any unknown field, bad
enum value, or wrong type — the same clean signal the rest of the aggregate uses.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .errors import InvariantViolation

# --------------------------------------------------------------------------- catalog
SHARINGS = frozenset({"single", "double", "triple", "quad", "five_plus", "dormitory"})
CONFIGS = frozenset({"rk", "studio", "1bhk", "2bhk", "3bhk", "4bhk_plus"})
FURNISHINGS = frozenset({"unfurnished", "semi_furnished", "fully_furnished"})
# Food is binary: included or not. ("optional" was a third state — dropped; legacy values
# are coerced to "included" on read, see _LEGACY_ENUM_ALIASES.)
FOODS = frozenset({"none", "included"})
BILLING_BASES = frozenset({"per_bed", "per_unit"})
BILLING_PERIODS = frozenset({"monthly", "weekly", "daily"})
SERVICES = frozenset(
    {"housekeeping", "meals", "linen", "laundry", "wifi", "utilities", "power_backup", "security"}
)
AMENITIES = frozenset(
    {
        "wifi", "ac", "geyser", "attached_bathroom", "balcony", "parking", "lift",
        "power_backup", "cctv", "washing_machine", "refrigerator", "tv", "study_table",
        "wardrobe", "hot_water", "drinking_water", "daily_cleaning", "gym", "common_area",
        # Premium / co-living amenities (real operators have these — see the live audit).
        "swimming_pool", "sports_court", "recreation_room", "garden", "rooftop", "club_house",
    }
)

# Enum values that were valid in earlier versions, mapped to their current equivalent so
# stored snapshots keep loading after a catalog change (no migration needed).
_LEGACY_ENUM_ALIASES: dict[str, dict[str, str]] = {
    "food": {"optional": "included"},  # food-optional → food-included (it was available)
}

# Each curated attribute → how to validate it. Enum fields carry their allowed set;
# multi fields are subsets of a set; scalar fields carry a python type.
_ENUM_FIELDS: dict[str, frozenset[str]] = {
    "sharing": SHARINGS,
    "config": CONFIGS,
    "furnishing": FURNISHINGS,
    "food": FOODS,
}
_MULTI_FIELDS: dict[str, frozenset[str]] = {
    "services": SERVICES,
    "amenities": AMENITIES,
}
_SCALAR_FIELDS: dict[str, type] = {
    "ac": bool,
    "carpet_area_sqft": int,
    "deposit_months": int,
    "deposit_amount": int,
    "lock_in_months": int,
    "notice_days": int,
    "min_stay": int,
    "maintenance_amount": int,  # monthly maintenance charge (₹), separate from rent
}
ATTR_FIELDS = frozenset(_ENUM_FIELDS) | frozenset(_MULTI_FIELDS) | frozenset(_SCALAR_FIELDS)


@dataclass
class Offering:
    id: str
    name: str
    price: int | None = None
    billing_basis: str = "per_bed"
    billing_period: str = "monthly"
    active: bool = True
    # curated attributes (all optional, all catalog-validated):
    sharing: str | None = None
    config: str | None = None
    furnishing: str | None = None
    food: str | None = None
    ac: bool = False
    services: list[str] = field(default_factory=list)
    amenities: list[str] = field(default_factory=list)
    carpet_area_sqft: int | None = None
    deposit_months: int | None = None
    deposit_amount: int | None = None
    lock_in_months: int | None = None
    notice_days: int | None = None
    min_stay: int | None = None
    maintenance_amount: int | None = None


def validate_billing(billing_basis: str | None, billing_period: str | None) -> None:
    if billing_basis is not None and billing_basis not in BILLING_BASES:
        raise InvariantViolation(f"unknown billing_basis {billing_basis!r}")
    if billing_period is not None and billing_period not in BILLING_PERIODS:
        raise InvariantViolation(f"unknown billing_period {billing_period!r}")


def validate_attrs(attrs: dict) -> dict:
    """Reject unknown fields, bad enum values, out-of-catalog multi-values, and wrong types
    (bools are NOT ints and vice-versa). Returns a defensively-copied dict — list values are
    cloned so the aggregate never aliases the caller's mutable objects."""
    safe: dict = {}
    for key, value in attrs.items():
        if key not in ATTR_FIELDS:
            raise InvariantViolation(
                f"unknown offering field {key!r}. Valid fields: {sorted(ATTR_FIELDS)}"
            )
        if key in _ENUM_FIELDS:
            value = _LEGACY_ENUM_ALIASES.get(key, {}).get(value, value)  # legacy → current
            if value is not None and value not in _ENUM_FIELDS[key]:
                raise InvariantViolation(
                    f"{key}={value!r} is not in the catalog. Valid: {sorted(_ENUM_FIELDS[key])}"
                )
            safe[key] = value
        elif key in _MULTI_FIELDS:
            if not isinstance(value, list):
                raise InvariantViolation(f"{key} must be a list")
            bad = set(value) - _MULTI_FIELDS[key]
            if bad:
                raise InvariantViolation(
                    f"{key} has values not in the catalog: {sorted(bad)}. "
                    f"Valid: {sorted(_MULTI_FIELDS[key])}"
                )
            safe[key] = list(value)  # clone — no aliasing into the aggregate
        else:  # scalar
            expected = _SCALAR_FIELDS[key]
            if value is None:
                safe[key] = None
                continue
            if expected is bool:
                if not isinstance(value, bool):
                    raise InvariantViolation(f"{key} must be a bool")
            else:  # int — reject bool (bool is an int subclass in python)
                if isinstance(value, bool) or not isinstance(value, expected):
                    raise InvariantViolation(f"{key} must be an {expected.__name__}")
            safe[key] = value
    return safe
