"""Tests for the _deep_merge utility in tools/state.py."""
import pytest
from tarini.tools.state import _deep_merge


def test_shallow_overwrite():
    result = _deep_merge({"a": 1, "b": 2}, {"b": 99})
    assert result == {"a": 1, "b": 99}


def test_adds_new_keys():
    result = _deep_merge({"a": 1}, {"b": 2})
    assert result == {"a": 1, "b": 2}


def test_nested_dict_is_merged_not_replaced():
    base = {"meta": {"name": "Green PG", "type": "pg"}}
    updates = {"meta": {"type": "hostel"}}
    result = _deep_merge(base, updates)
    assert result["meta"]["name"] == "Green PG"  # preserved
    assert result["meta"]["type"] == "hostel"    # overwritten


def test_list_is_overwritten_not_appended():
    base = {"floors": [{"index": 0, "label": "Ground"}]}
    updates = {"floors": [{"index": 0, "label": "G"}, {"index": 1, "label": "First"}]}
    result = _deep_merge(base, updates)
    assert len(result["floors"]) == 2


def test_does_not_mutate_base():
    base = {"a": {"x": 1}}
    _deep_merge(base, {"a": {"x": 2}})
    assert base["a"]["x"] == 1  # original unchanged


def test_empty_updates_returns_copy_of_base():
    base = {"a": 1}
    result = _deep_merge(base, {})
    assert result == base
    assert result is not base


def test_deeply_nested_merge():
    base = {"l1": {"l2": {"l3": "original", "other": "keep"}}}
    updates = {"l1": {"l2": {"l3": "updated"}}}
    result = _deep_merge(base, updates)
    assert result["l1"]["l2"]["l3"] == "updated"
    assert result["l1"]["l2"]["other"] == "keep"
