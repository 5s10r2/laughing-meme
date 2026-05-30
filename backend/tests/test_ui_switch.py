"""The two operator switches:

  1. USE_NEW_EXPERIENCE — legacy backend vs the redesigned one (default: legacy).
  2. ENABLE_UI_COMPONENTS — generative UI vs pure-text AI chat (default: UI on).

Switch 2 drops emit_ui from the tool list Claude is offered, so it physically
cannot render components — a clean fallback to text-only, in BOTH backend paths.
"""
from __future__ import annotations

from tarini.agent import _select_tools, _ui_components_enabled, _use_new_experience
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
# NOTE: emit_ui currently lives only in the LEGACY tool set [..., emit_ui].
# The v2 set is [get_model, apply_commands] — the new experience's component
# emission is the pending Phase B wiring. _select_tools gates emit_ui WHEREVER it
# appears, so it's active for legacy now and forward-compatible for v2 later.
def test_ui_components_enabled_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_UI_COMPONENTS", raising=False)
    assert _ui_components_enabled() is True
    assert "emit_ui" in [t["name"] for t in _select_tools(TOOL_DEFINITIONS)]
    # enabled → list returned unchanged in content
    assert [t["name"] for t in _select_tools(TOOL_DEFINITIONS_V2)] == \
        [t["name"] for t in TOOL_DEFINITIONS_V2]


def test_ui_components_disabled_drops_emit_ui_from_legacy(monkeypatch):
    monkeypatch.setenv("ENABLE_UI_COMPONENTS", "0")
    assert _ui_components_enabled() is False
    legacy = [t["name"] for t in _select_tools(TOOL_DEFINITIONS)]
    assert "emit_ui" not in legacy
    assert len(legacy) == len(TOOL_DEFINITIONS) - 1
    assert set(legacy) == {t["name"] for t in TOOL_DEFINITIONS} - {"emit_ui"}
    # v2 has no emit_ui today → the switch is a no-op there (forward-compatible)
    assert [t["name"] for t in _select_tools(TOOL_DEFINITIONS_V2)] == \
        [t["name"] for t in TOOL_DEFINITIONS_V2]


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
