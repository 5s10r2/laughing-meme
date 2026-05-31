"""Phase B wiring: emit_ui offers the blueprint components in the v2 path, and the
shared validator accepts them so the v2 emit_ui handler can render them.

The actual model→props enrichment lives in tarini.blueprint (unit-tested there) and
is invoked from the v2 stream loop; here we lock the contract that makes that path
reachable: the tool is offered, the enum matches the registry, and validation passes.
"""
from __future__ import annotations

from tarini.blueprint import BLUEPRINT_COMPONENTS
from tarini.tools.agent_tools import TOOL_DEFINITIONS_V2
from tarini.tools.ui import AVAILABLE_COMPONENTS, validate_emit_ui


def _emit_ui_def() -> dict:
    return next(t for t in TOOL_DEFINITIONS_V2 if t["name"] == "emit_ui")


def test_v2_offers_emit_ui_alongside_get_model_and_apply_commands():
    names = [t["name"] for t in TOOL_DEFINITIONS_V2]
    assert names == ["get_model", "apply_commands", "emit_ui"]


def test_v2_emit_ui_enum_is_blueprint_set_plus_quick_replies():
    enum = _emit_ui_def()["input_schema"]["properties"]["component"]["enum"]
    # the model-projected blueprint set + the Claude-authored QuickReplyChips
    assert set(enum) == set(BLUEPRINT_COMPONENTS) | {"QuickReplyChips"}
    # blueprint names stay sorted+first (stable prompt cache); chips appended last
    assert enum[:-1] == sorted(BLUEPRINT_COMPONENTS) and enum[-1] == "QuickReplyChips"


def test_quick_reply_chips_is_validatable_and_not_a_blueprint_projection():
    from tarini.blueprint import is_blueprint_component
    # accepted by the shared validator, but NOT model-projected → Claude's props pass through
    assert validate_emit_ui("QuickReplyChips", {"options": [{"label": "Men", "value": "Men"}]}) is None
    assert is_blueprint_component("QuickReplyChips") is False


def test_v2_emit_ui_props_are_optional():
    """Backend fills props, so the model isn't required to author them."""
    schema = _emit_ui_def()["input_schema"]
    assert schema["required"] == ["component"]


def test_validator_accepts_every_blueprint_component():
    for name in BLUEPRINT_COMPONENTS:
        assert name in AVAILABLE_COMPONENTS
        assert validate_emit_ui(name, {}) is None  # empty props OK — backend fills them


def test_validator_still_rejects_unknown_components():
    assert validate_emit_ui("NotARealComponent", {}) is not None
