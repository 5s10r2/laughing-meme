# Phase 7: Reliability & Client Lifecycle - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix history trimming to respect message alternation, add timeout to Anthropic stream calls, and make the Anthropic client a singleton.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints:
- Anthropic API requires strict user/assistant alternation — trimmed history must maintain this
- Tool results are sent as `user` role messages containing `tool_result` blocks
- Timeout should yield a proper SSE error event, not crash the generator
- Singleton client must be lazy (env var may not be set at import time)

</decisions>

<code_context>
## Existing Code Insights

### Current Issues
- `agent.py:35-44` — `_trim_history_for_api()` slices last N messages without checking alternation
- `agent.py:86` — `client = anthropic.AsyncAnthropic(...)` created per `stream_chat()` call
- `agent.py:105-115` — `client.messages.stream()` has no timeout

### Established Patterns
- Error events yielded as `{"type": "error", "message": "..."}`
- Module-level constants for configuration
- `os.environ` for API keys

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
