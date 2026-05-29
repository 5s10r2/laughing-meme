"""Tests for state_schema.validate_onboarding_state."""
import pytest
from tarini.state_schema import validate_onboarding_state


def test_empty_state_is_valid():
    state, errors = validate_onboarding_state({})
    assert errors is None
    assert state == {}


def test_valid_full_state():
    raw = {
        "user_name": "Sanchay",
        "property_name": "Green PG",
        "property_type": "pg",
        "gender_preference": "coed",
        "floors": [{"index": 0, "label": "Ground Floor"}],
        "units": [
            {
                "id": "u1",
                "name": "101",
                "floor_index": 0,
                "category": "single",
                "sharing_type": "private",
            }
        ],
        "packages": [
            {
                "id": "pkg1",
                "name": "Standard",
                "category": "single",
                "starting_rent": 8000,
                "security_deposit": 16000,
            }
        ],
    }
    state, errors = validate_onboarding_state(raw)
    assert errors is None
    assert state["property_type"] == "pg"
    assert state["floors"][0]["index"] == 0


def test_property_type_is_normalised_to_lowercase():
    state, errors = validate_onboarding_state({"property_type": "PG"})
    assert errors is None
    assert state["property_type"] == "pg"


def test_invalid_property_type_returns_errors():
    _, errors = validate_onboarding_state({"property_type": "mansion"})
    assert errors is not None
    assert len(errors) > 0


def test_invalid_sharing_type_on_unit():
    raw = {
        "units": [
            {
                "id": "u1",
                "name": "101",
                "floor_index": 0,
                "category": "single",
                "sharing_type": "penthouse",  # invalid
            }
        ]
    }
    _, errors = validate_onboarding_state(raw)
    assert errors is not None


def test_negative_rent_fails():
    raw = {"packages": [{"id": "p1", "name": "A", "category": "single", "starting_rent": -100}]}
    _, errors = validate_onboarding_state(raw)
    assert errors is not None


def test_extra_field_is_rejected():
    _, errors = validate_onboarding_state({"unknown_field": "value"})
    assert errors is not None


def test_none_values_excluded_from_output():
    state, errors = validate_onboarding_state({"user_name": "Test"})
    assert errors is None
    assert "floors" not in state  # None fields are excluded
    assert state["user_name"] == "Test"
