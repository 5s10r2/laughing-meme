"""Command codec tests — strict boundary validation of Claude's JSON command payloads."""
from __future__ import annotations

import typing

import pytest

from tarini.application.command_codec import (
    COMMAND_TYPES,
    CommandDecodeError,
    command_catalog_text,
    decode_command,
    decode_commands,
)
from tarini.domain import commands as c


def test_catalog_covers_every_domain_command():
    # the codec vocabulary must match the domain Command union exactly — no drift
    union = {t.__name__ for t in typing.get_args(c.Command)}
    assert set(COMMAND_TYPES) == union


def test_decode_set_property():
    cmd = decode_command({"op": "SetProperty", "name": "Sunrise", "location": "HSR"})
    assert isinstance(cmd, c.SetProperty)
    assert cmd.name == "Sunrise" and cmd.location == "HSR"
    assert cmd.type is None  # unspecified optional stays default


def test_decode_command_with_list_and_defaults():
    cmd = decode_command({"op": "CreatePackage", "name": "AC Double", "rent": 9000,
                          "amenities": ["wifi", "ac"]})
    assert isinstance(cmd, c.CreatePackage)
    assert cmd.amenities == ["wifi", "ac"]
    assert cmd.food == "none"  # default preserved


def test_unknown_op_rejected():
    with pytest.raises(CommandDecodeError) as ei:
        decode_command({"op": "Frobnicate", "x": 1})
    assert "unknown command op" in str(ei.value)


def test_missing_op_rejected():
    with pytest.raises(CommandDecodeError):
        decode_command({"name": "X"})


def test_unknown_field_rejected():
    with pytest.raises(CommandDecodeError) as ei:
        decode_command({"op": "SetProperty", "naem": "typo"})
    assert "unknown field" in str(ei.value)


def test_missing_required_field_rejected():
    # CreatePackage requires `name`
    with pytest.raises(CommandDecodeError) as ei:
        decode_command({"op": "CreatePackage", "rent": 9000})
    assert "missing required field" in str(ei.value)


def test_non_dict_command_rejected():
    with pytest.raises(CommandDecodeError):
        decode_command(["not", "a", "dict"])  # type: ignore[arg-type]


def test_decode_batch_and_empty_and_non_list():
    cmds = decode_commands([
        {"op": "SetProperty", "name": "X"},
        {"op": "AddFloors", "count": 2},
    ])
    assert [type(x).__name__ for x in cmds] == ["SetProperty", "AddFloors"]

    with pytest.raises(CommandDecodeError):
        decode_commands([])
    with pytest.raises(CommandDecodeError):
        decode_commands({"op": "SetProperty"})  # type: ignore[arg-type]


def test_batch_fails_fast_on_bad_command():
    # second command is malformed → whole decode raises, nothing returned
    with pytest.raises(CommandDecodeError):
        decode_commands([
            {"op": "SetProperty", "name": "X"},
            {"op": "CreatePackage"},  # missing name
        ])


def test_catalog_text_marks_optional_and_required():
    text = command_catalog_text()
    assert "SetProperty(" in text
    # name is optional on SetProperty (all fields default None) → marked with ?
    assert "CreatePackage(name," in text  # name required → no ?
    assert "rent?" in text                # rent optional → ?
