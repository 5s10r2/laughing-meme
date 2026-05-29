from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FloorState(StrictModel):
    index: int = Field(ge=0)
    label: str = Field(min_length=1)
    active: bool = True


class UnitState(StrictModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    floor_index: int = Field(ge=0)
    category: str = Field(min_length=1)
    sharing_type: Literal["private", "double", "triple", "dormitory"] | None = None
    bhk_variant: str | None = None
    package_id: str | None = None
    active: bool = True


class PackageState(StrictModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    sharing_type: Literal["private", "double", "triple", "dormitory"] | None = None
    furnishing: Literal["fully_furnished", "semi_furnished", "unfurnished"] | None = None
    amenities: list[str] | None = None
    food_included: bool | None = None
    food_optional: bool | None = None
    starting_rent: int | None = Field(default=None, ge=0)
    security_deposit: int | None = Field(default=None, ge=0)
    lock_in_period: int | None = Field(default=None, ge=0)
    notice_period: int | None = Field(default=None, ge=0)
    active: bool = True
    disabled: bool | None = None


class NamingPatternState(StrictModel):
    pattern: str = Field(min_length=1)
    start: int = Field(ge=0)


class OnboardingState(StrictModel):
    user_name: str | None = None
    property_name: str | None = None
    property_type: Literal["pg", "hostel", "flat", "studio", "rk", "coliving", "mixed"] | None = None
    property_location: str | None = None
    gender_preference: Literal["male", "female", "coed"] | None = None
    floors: list[FloorState] | None = None
    units: list[UnitState] | None = None
    packages: list[PackageState] | None = None
    naming_patterns: dict[str, NamingPatternState] | None = None

    @field_validator("property_type", "gender_preference", mode="before")
    @classmethod
    def normalize_lowercase(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


def validate_onboarding_state(raw_state: dict) -> tuple[dict | None, list[dict] | None]:
    try:
        state = OnboardingState.model_validate(raw_state)
    except ValidationError as exc:
        return None, exc.errors(include_url=False, include_input=False)
    return state.model_dump(exclude_none=True), None


STATE_UPDATE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "user_name": {"type": "string"},
        "property_name": {"type": "string"},
        "property_type": {
            "type": "string",
            "enum": ["pg", "hostel", "flat", "studio", "rk", "coliving", "mixed"],
        },
        "property_location": {"type": "string"},
        "gender_preference": {"type": "string", "enum": ["male", "female", "coed"]},
        "floors": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "index": {"type": "integer", "minimum": 0},
                    "label": {"type": "string"},
                    "active": {"type": "boolean"},
                },
                "required": ["index", "label"],
            },
        },
        "units": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "floor_index": {"type": "integer", "minimum": 0},
                    "category": {"type": "string"},
                    "sharing_type": {
                        "type": "string",
                        "enum": ["private", "double", "triple", "dormitory"],
                    },
                    "bhk_variant": {"type": "string"},
                    "package_id": {"type": "string"},
                    "active": {"type": "boolean"},
                },
                "required": ["id", "name", "floor_index", "category"],
            },
        },
        "packages": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "category": {"type": "string"},
                    "sharing_type": {
                        "type": "string",
                        "enum": ["private", "double", "triple", "dormitory"],
                    },
                    "furnishing": {
                        "type": "string",
                        "enum": ["fully_furnished", "semi_furnished", "unfurnished"],
                    },
                    "amenities": {"type": "array", "items": {"type": "string"}},
                    "food_included": {"type": "boolean"},
                    "food_optional": {"type": "boolean"},
                    "starting_rent": {"type": "integer", "minimum": 0},
                    "security_deposit": {"type": "integer", "minimum": 0},
                    "lock_in_period": {"type": "integer", "minimum": 0},
                    "notice_period": {"type": "integer", "minimum": 0},
                    "active": {"type": "boolean"},
                    "disabled": {"type": "boolean"},
                },
                "required": ["id", "name", "category"],
            },
        },
        "naming_patterns": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "pattern": {"type": "string"},
                    "start": {"type": "integer", "minimum": 0},
                },
                "required": ["pattern", "start"],
            },
        },
    },
}
