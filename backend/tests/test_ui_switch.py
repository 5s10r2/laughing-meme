"""The two operator switches:

  1. USE_NEW_EXPERIENCE — legacy backend vs the redesigned one (default: legacy).
  2. ENABLE_UI_COMPONENTS — generative UI vs pure-text AI chat (default: UI on).

Switch 2 drops emit_ui from the tool list Claude is offered, so it physically
cannot render components — a clean fallback to text-only, in BOTH backend paths.
"""
from __future__ import annotations

from tarini.agent import (
    _chat_only_suffix,
    _select_tools,
    _ui_components_enabled,
    _use_new_experience,
)
from tarini.tools import TOOL_DEFINITIONS
from tarini.tools.agent_tools import TOOL_DEFINITIONS_V2


# ---- switch 1: legacy vs new (default legacy, instant rollback) -------------
def test_use_new_experience_default_off(monkeypatch):
    monkeypatch.delenv("USE_NEW_EXPERIENCE", raising=False)
    assert _use_new_experience() is False
    for on in ("1", "true", "yes", "on"):
        monkeypatch.setenv("USE_NEW_EXPERIENCE", on)
        assert _use_new_experience() is True
    monkeypatch.setenv("USE_NEW_EXPERIENCE", "0")
    assert _use_new_experience() is False


# ---- switch 2: chat-only vs chat+UI (default UI on) ------------------------
# emit_ui now lives in BOTH tool sets: legacy [..., emit_ui] and v2
# [get_model, apply_commands, emit_ui] (Phase B wired the blueprint components in).
# _select_tools gates emit_ui WHEREVER it appears, so the chat-only switch is fully
# functional in both the legacy and the redesigned experience.
def test_ui_components_enabled_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_UI_COMPONENTS", raising=False)
    assert _ui_components_enabled() is True
    assert "emit_ui" in [t["name"] for t in _select_tools(TOOL_DEFINITIONS)]
    assert "emit_ui" in [t["name"] for t in _select_tools(TOOL_DEFINITIONS_V2)]
    # enabled → both lists returned unchanged in content
    assert [t["name"] for t in _select_tools(TOOL_DEFINITIONS_V2)] == \
        [t["name"] for t in TOOL_DEFINITIONS_V2]


def test_ui_components_disabled_drops_emit_ui_from_both_paths(monkeypatch):
    monkeypatch.setenv("ENABLE_UI_COMPONENTS", "0")
    assert _ui_components_enabled() is False
    legacy = [t["name"] for t in _select_tools(TOOL_DEFINITIONS)]
    assert "emit_ui" not in legacy
    assert set(legacy) == {t["name"] for t in TOOL_DEFINITIONS} - {"emit_ui"}
    # v2 now carries emit_ui too → the switch drops it there as well
    v2 = [t["name"] for t in _select_tools(TOOL_DEFINITIONS_V2)]
    assert "emit_ui" not in v2
    assert set(v2) == {t["name"] for t in TOOL_DEFINITIONS_V2} - {"emit_ui"}


def test_select_tools_gates_emit_ui_generically(monkeypatch):
    """Proves the v2 path WILL gate emit_ui once Phase B adds it."""
    sample = [{"name": "get_model"}, {"name": "emit_ui"}, {"name": "apply_commands"}]
    monkeypatch.delenv("ENABLE_UI_COMPONENTS", raising=False)
    assert [t["name"] for t in _select_tools(sample)] == ["get_model", "emit_ui", "apply_commands"]
    monkeypatch.setenv("ENABLE_UI_COMPONENTS", "0")
    assert [t["name"] for t in _select_tools(sample)] == ["get_model", "apply_commands"]


def test_ui_switch_accepts_common_falsey_and_truthy(monkeypatch):
    for falsey in ("0", "false", "FALSE", "no", "off", "Off"):
        monkeypatch.setenv("ENABLE_UI_COMPONENTS", falsey)
        assert _ui_components_enabled() is False
    for truthy in ("1", "true", "yes", "on", ""):  # "" / unset → default on
        monkeypatch.setenv("ENABLE_UI_COMPONENTS", truthy)
        assert _ui_components_enabled() is True


def test_select_tools_does_not_mutate_input(monkeypatch):
    monkeypatch.setenv("ENABLE_UI_COMPONENTS", "0")
    before = len(TOOL_DEFINITIONS_V2)
    _select_tools(TOOL_DEFINITIONS_V2)
    assert len(TOOL_DEFINITIONS_V2) == before  # original list untouched


def test_chat_only_prompt_suffix(monkeypatch):
    """In chat-only mode the model is told to stay text-only (so it won't narrate
    components it can't render); enabled → no suffix (prompt + cache unchanged)."""
    monkeypatch.delenv("ENABLE_UI_COMPONENTS", raising=False)
    assert _chat_only_suffix() == ""
    monkeypatch.setenv("ENABLE_UI_COMPONENTS", "0")
    assert "text only" in _chat_only_suffix().lower()
