"""Tree command codec (heterogeneity Phase D, step 1).

Decodes Claude's `op`-tagged JSON into the frozen Space commands, reusing the same strict
boundary (unknown op/field, missing required, wrong value type → CommandDecodeError). The
codec is parameterised by a command-types map, so the legacy vocabulary is untouched.
"""
from __future__ import annotations

import pytest

from tarini.application.command_codec import (
    CommandDecodeError,
    decode_space_command,
    decode_space_commands,
    space_command_catalog_text,
)
from tarini.domain import space_commands as sc


def test_decode_add_spaces():
    cmd = decode_space_command({"op": "AddSpaces", "parent_id": "p1", "kind": "room", "count": 3})
    assert isinstance(cmd, sc.AddSpaces)
    assert cmd.parent_id == "p1" and cmd.kind == "room" and cmd.count == 3


def test_decode_create_offering_with_attrs_dict():
    cmd = decode_space_command({
        "op": "CreateOffering", "name": "AC Double", "price": 9000,
        "attrs": {"sharing": "double", "ac": True},
    })
    assert isinstance(cmd, sc.CreateOffering)
    assert cmd.attrs == {"sharing": "double", "ac": True}


def test_decode_set_property_partial_and_publish():
    assert isinstance(decode_space_command({"op": "SetProperty", "name": "X"}), sc.SetProperty)
    assert isinstance(decode_space_command({"op": "Publish"}), sc.Publish)


def test_decode_map_offering_list():
    cmd = decode_space_command({"op": "MapOffering", "space_ids": ["a", "b"], "offering_id": "o1"})
    assert cmd.space_ids == ["a", "b"] and cmd.offering_id == "o1"


def test_unknown_op_rejected():
    with pytest.raises(CommandDecodeError):
        decode_space_command({"op": "Teleport", "x": 1})


def test_wrong_value_type_rejected():
    with pytest.raises(CommandDecodeError):
        decode_space_command({"op": "AddSpaces", "parent_id": "p", "kind": "room", "count": "three"})
    with pytest.raises(CommandDecodeError):
        decode_space_command({"op": "MapOffering", "space_ids": "not-a-list", "offering_id": "o"})


def test_unknown_field_and_missing_required():
    with pytest.raises(CommandDecodeError):
        decode_space_command({"op": "RenameSpace", "space_id": "s", "label": "L", "colour": "red"})
    with pytest.raises(CommandDecodeError):
        decode_space_command({"op": "RenameSpace", "space_id": "s"})  # missing label


def test_decode_batch_fails_fast():
    with pytest.raises(CommandDecodeError):
        decode_space_commands([{"op": "Publish"}, {"op": "Nope"}])
    out = decode_space_commands([{"op": "Publish"}, {"op": "AddSpaces", "parent_id": "p", "kind": "floor"}])
    assert len(out) == 2


def test_catalog_text_lists_space_ops():
    text = space_command_catalog_text()
    assert "AddSpaces(" in text and "CreateOffering(" in text and "SetProperty(" in text
