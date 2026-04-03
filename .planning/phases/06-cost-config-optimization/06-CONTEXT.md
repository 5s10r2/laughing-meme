# Phase 6: Cost & Configuration Optimization - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix prompt caching to actually reduce API costs, cache the system prompt at module load time, and make the AI model configurable via environment variable.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints:
- Anthropic prompt caching requires `cache_control` on content blocks within the `system` parameter, not at the API call level
- System prompt is ~4K tokens / 562 lines — significant cost saving when cached
- Model env var should have a sensible default so existing deployments don't break

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tarini/prompts/__init__.py` — `load_system_prompt()` reads from disk, `INITIAL_PROMPT` constant
- `backend/tarini/agent.py` — `MODEL` constant at line 26, `stream_chat()` at line 69

### Established Patterns
- Constants defined at module level (e.g., `MODEL`, `MAX_TOOL_ROUNDS`, `_MAX_API_HISTORY`)
- Environment variables accessed via `os.environ` (see `ANTHROPIC_API_KEY` usage)
- System prompt loaded via `load_system_prompt()` called inside `stream_chat()`

### Integration Points
- `agent.py:105-112` — `client.messages.stream()` call where `system=` and `cache_control=` are passed
- `agent.py:87` — where `load_system_prompt()` is called per turn
- `agent.py:26` — where `MODEL` is hardcoded

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
