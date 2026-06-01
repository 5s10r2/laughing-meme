"""A5 integration tests — the USE_NEW_EXPERIENCE path through stream_chat.

The streaming loop is exercised end-to-end with a faithful fake Anthropic client (no network,
no API key), so the SSE-contract assertions are real: text → tool_start → tool_complete →
state_snapshot (in the legacy frontend shape) → done. The new path must also persist the model
through CommandService and leave the legacy path's behaviour untouched when the flag is off.
"""
from __future__ import annotations

import pytest

import tarini.agent as agent
from tarini.adapters.inmemory_repository import InMemoryPropertyRepository
from tarini.application.command_service import CommandService
from tarini.flags import use_new_experience


# =========================================================================== fakes
class _Delta:
    def __init__(self, text: str) -> None:
        self.type = "text_delta"
        self.text = text


class _ContentBlockDelta:
    def __init__(self, text: str) -> None:
        self.type = "content_block_delta"
        self.delta = _Delta(text)


class _TextBlock:
    type = "text"

    def __init__(self, text: str) -> None:
        self.text = text


class _ToolUseBlock:
    type = "tool_use"

    def __init__(self, id: str, name: str, input: dict) -> None:
        self.id = id
        self.name = name
        self.input = input


class _Usage:
    input_tokens = 12
    output_tokens = 7
    cache_read_input_tokens = 0
    cache_creation_input_tokens = 0


class _FinalMessage:
    def __init__(self, content: list, stop_reason: str) -> None:
        self.content = content
        self.stop_reason = stop_reason
        self.usage = _Usage()


class _StreamCtx:
    def __init__(self, deltas: list, final: _FinalMessage) -> None:
        self._deltas = deltas
        self._final = final

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def __aiter__(self):  # async iterator
        for d in self._deltas:
            yield d

    async def get_final_message(self):
        return self._final


class _Messages:
    def __init__(self, rounds: list[dict]) -> None:
        self._rounds = rounds
        self._i = 0

    def stream(self, **kwargs):
        r = self._rounds[self._i]
        self._i += 1
        # capture what the loop sent the model (tools/system) for assertions
        _Messages.last_kwargs = kwargs
        return _StreamCtx(r["deltas"], r["final"])


class _FakeClient:
    def __init__(self, rounds: list[dict]) -> None:
        self.messages = _Messages(rounds)


@pytest.fixture
def new_experience(monkeypatch):
    """Flag on + a fresh in-memory CommandService wired into the agent module."""
    monkeypatch.setenv("USE_NEW_EXPERIENCE", "true")
    svc = CommandService(InMemoryPropertyRepository())
    monkeypatch.setattr(agent, "_command_service", svc)
    return svc


async def _collect(session_id, message, history):
    return [event async for event in agent.stream_chat(session_id, message, history)]


# =========================================================================== flag + mapper
def test_use_new_experience_defaults_off(monkeypatch):
    monkeypatch.delenv("USE_NEW_EXPERIENCE", raising=False)
    assert use_new_experience() is False


def test_use_new_experience_truthy_values(monkeypatch):
    for v in ("true", "1", "yes", "on", "TRUE"):
        monkeypatch.setenv("USE_NEW_EXPERIENCE", v)
        assert use_new_experience() is True
    monkeypatch.setenv("USE_NEW_EXPERIENCE", "false")
    assert use_new_experience() is False


def test_snapshot_event_from_model_result():
    result = {"ok": True, "model": {"name": "Sunrise"}, "completeness": {"facets": {}}, "version": 3}
    ev = agent._snapshot_event(result)
    assert ev["type"] == "state_snapshot"
    assert ev["state"]["property_name"] == "Sunrise"
    assert ev["stateVersion"] == 3


def test_snapshot_event_none_for_error_result():
    assert agent._snapshot_event({"error": "boom", "code": "BAD_COMMAND"}) is None
    assert agent._snapshot_event("not a dict") is None


def test_opening_prompt_matches_active_experience(monkeypatch):
    from tarini.prompts import INITIAL_PROMPT, INITIAL_PROMPT_V2

    monkeypatch.delenv("USE_NEW_EXPERIENCE", raising=False)
    assert agent.opening_prompt() == INITIAL_PROMPT       # legacy: "call get_state"

    monkeypatch.setenv("USE_NEW_EXPERIENCE", "true")
    assert agent.opening_prompt() == INITIAL_PROMPT_V2     # new: "call get_model"


# =========================================================================== SSE contract
async def test_v2_apply_commands_emits_legacy_state_snapshot(new_experience, monkeypatch):
    rounds = [
        {  # round 0: model narrates, then calls apply_commands
            "deltas": [_ContentBlockDelta("Let me set that up. ")],
            "final": _FinalMessage(
                content=[
                    _TextBlock("Let me set that up. "),
                    _ToolUseBlock("tu1", "apply_commands", {"commands": [
                        {"op": "SetProperty", "name": "Sunrise PG", "type": "pg", "location": "HSR"},
                    ]}),
                ],
                stop_reason="tool_use",
            ),
        },
        {  # round 1: model replies, no tool use → done
            "deltas": [_ContentBlockDelta("All set!")],
            "final": _FinalMessage(content=[_TextBlock("All set!")], stop_reason="end_turn"),
        },
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s1", "I run Sunrise PG, a pg in HSR", [])
    types = [e["type"] for e in events]

    assert "text" in types
    assert "tool_start" in types and "tool_complete" in types
    assert "state_snapshot" in types
    assert types[-1] == "done"

    snap = next(e for e in events if e["type"] == "state_snapshot")
    assert snap["state"]["property_name"] == "Sunrise PG"
    assert snap["state"]["property_type"] == "pg"
    assert snap["stateVersion"] == 1
    assert snap["stage"] == "structure"  # property complete → next facet

    tc = next(e for e in events if e["type"] == "tool_complete")
    assert tc["tool"] == "apply_commands"
    assert tc["result"]["ok"] is True


async def test_v2_persists_through_command_service(new_experience, monkeypatch):
    rounds = [
        {
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu1", "apply_commands", {"commands": [
                    {"op": "SetProperty", "name": "Galaxy", "type": "hostel", "location": "BTM"},
                ]})],
                stop_reason="tool_use",
            ),
        },
        {"deltas": [_ContentBlockDelta("ok")],
         "final": _FinalMessage(content=[_TextBlock("ok")], stop_reason="end_turn")},
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    await _collect("s2", "set it up", [])
    model = await new_experience.get_model("s2")
    assert model["version"] == 1
    assert model["model"]["name"] == "Galaxy"


async def test_v2_blueprint_emit_props_come_from_the_model_not_claude(new_experience, monkeypatch):
    """When Claude emits a blueprint component, the backend overrides its props with the
    projection from the saved model — even if Claude sends garbage props."""
    rounds = [
        {  # round 0: build a 2-floor property
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu1", "apply_commands", {"commands": [
                    {"op": "SetProperty", "name": "Sunrise PG", "type": "pg", "location": "HSR"},
                    {"op": "AddFloors", "count": 2, "start_index": 1},
                ]})],
                stop_reason="tool_use",
            ),
        },
        {  # round 1: emit the massing model with deliberately wrong props
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu2", "emit_ui", {
                    "component": "MassingModel",
                    "props": {"propertyName": "WRONG", "blocks": [{"label": "Garbage", "floors": 99}]},
                })],
                stop_reason="tool_use",
            ),
        },
        {"deltas": [_ContentBlockDelta("here it is")],
         "final": _FinalMessage(content=[_TextBlock("here it is")], stop_reason="end_turn")},
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s4", "show me the building", [])
    comp = next(e for e in events if e["type"] == "component")
    assert comp["name"] == "MassingModel"
    # props are the projection of the saved model, NOT Claude's garbage
    assert comp["props"]["propertyName"] == "Sunrise PG"
    assert comp["props"]["blocks"] == [{"label": "Main", "floors": 2, "accentTop": True}]
    stats = {s["label"]: s["value"] for s in comp["props"]["stats"]}
    assert stats["Floors"] == 2
    # backend stays colourless — frontend maps category → palette
    assert "color" not in str(comp["props"])


async def test_v2_non_blueprint_emit_keeps_claude_props(new_experience, monkeypatch):
    """Legacy cards aren't backend-projected — their Claude-authored props pass through."""
    rounds = [
        {
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu1", "emit_ui", {
                    "component": "WelcomeHero", "props": {"headline": "Hi there"},
                })],
                stop_reason="tool_use",
            ),
        },
        {"deltas": [_ContentBlockDelta("ok")],
         "final": _FinalMessage(content=[_TextBlock("ok")], stop_reason="end_turn")},
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s5", "hi", [])
    comp = next(e for e in events if e["type"] == "component")
    assert comp["name"] == "WelcomeHero"
    assert comp["props"] == {"headline": "Hi there"}


async def test_v2_uses_v2_tools_and_v2_prompt(new_experience, monkeypatch):
    rounds = [{"deltas": [_ContentBlockDelta("hi")],
               "final": _FinalMessage(content=[_TextBlock("hi")], stop_reason="end_turn")}]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    await _collect("s3", "hello", [])
    sent = _Messages.last_kwargs
    tool_names = {t["name"] for t in sent["tools"]}
    assert tool_names == {"get_model", "apply_commands", "emit_ui"}
    # system is [cached core, live block] — two blocks, core cached
    assert isinstance(sent["system"], list) and len(sent["system"]) == 2
    assert sent["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "Tarini" in sent["system"][0]["text"]
    assert "Current model (live)" in sent["system"][1]["text"]


async def test_v2_emit_ui_yields_component_event(new_experience, monkeypatch):
    rounds = [
        {
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu1", "emit_ui", {"component": "WelcomeHero", "props": {}})],
                stop_reason="tool_use",
            ),
        },
        {"deltas": [_ContentBlockDelta("welcome")],
         "final": _FinalMessage(content=[_TextBlock("welcome")], stop_reason="end_turn")},
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s5", "hi", [])
    comp = next((e for e in events if e["type"] == "component"), None)
    assert comp is not None and comp["name"] == "WelcomeHero"
    # emit_ui shows no tool_start indicator (handled specially, like the legacy path)
    assert not any(e["type"] == "tool_start" for e in events)


async def test_v2_bad_command_does_not_crash_stream(new_experience, monkeypatch):
    rounds = [
        {  # model emits a malformed command
            "deltas": [],
            "final": _FinalMessage(
                content=[_ToolUseBlock("tu1", "apply_commands", {"commands": [{"op": "Bogus"}]})],
                stop_reason="tool_use",
            ),
        },
        {"deltas": [_ContentBlockDelta("let me fix that")],
         "final": _FinalMessage(content=[_TextBlock("fixing")], stop_reason="end_turn")},
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s4", "do something weird", [])
    types = [e["type"] for e in events]
    assert types[-1] == "done"                 # stream completed cleanly
    tc = next(e for e in events if e["type"] == "tool_complete")
    assert tc["result"]["code"] == "BAD_COMMAND"
    assert "state_snapshot" not in types        # nothing applied → no snapshot
    assert (await new_experience.get_model("s4"))["version"] == 0


async def test_v2_max_tool_rounds_yields_error_not_done(new_experience, monkeypatch):
    """When the model exhausts MAX_TOOL_ROUNDS without producing a text response,
    the stream must yield an 'error' event (not a silent 'done') so the frontend
    shows visible feedback instead of a zombie empty bubble."""
    import tarini.agent as _agent

    # Build MAX_TOOL_ROUNDS rounds that are all pure tool-use with no text.
    pure_tool_round = {
        "deltas": [],   # no text delta → any_visible stays False
        "final": _FinalMessage(
            content=[_ToolUseBlock("tu1", "get_model", {})],
            stop_reason="tool_use",
        ),
    }
    rounds = [pure_tool_round] * _agent.MAX_TOOL_ROUNDS
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s6", "keep looping", [])
    types = [e["type"] for e in events]

    # Must end with error, not done
    assert types[-1] == "error", f"expected 'error' as last event, got {types[-1]!r}"
    err = events[-1]
    assert err.get("code") == "MAX_TOOL_ROUNDS"
    assert "done" not in types


async def test_v2_silent_end_turn_still_yields_done(new_experience, monkeypatch):
    """A model response with stop_reason='end_turn' but no text/component emitted
    still yields 'done' (the frontend filter handles the empty bubble). The backend
    should NOT turn this into an error — history is intact for the next turn."""
    rounds = [
        {
            "deltas": [],   # no text at all
            "final": _FinalMessage(content=[_TextBlock("")], stop_reason="end_turn"),
        }
    ]
    monkeypatch.setattr(agent, "_get_anthropic_client", lambda: _FakeClient(rounds))

    events = await _collect("s7", "silent message", [])
    types = [e["type"] for e in events]

    assert types[-1] == "done", f"expected 'done', got {types}"
    assert "error" not in types
