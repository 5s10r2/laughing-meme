# Roadmap: Tarini Agent v1.1 — Backend Hardening

**Created:** 2026-04-03
**Milestone:** v1.1 — Backend Hardening
**Phases:** 3 (Phase 6-8, continuing from v1.0)
**Requirements covered:** 8/8 ✓

---

## Phase 6: Cost & Configuration Optimization

**Goal:** Fix prompt caching, cache system prompt at load time, and make the AI model configurable via environment variable.

**Requirements:** COST-01, COST-02, CONF-01

**Success Criteria:**
1. System prompt block has `cache_control: {"type": "ephemeral"}` on the content block (not the API call)
2. `load_system_prompt()` reads from disk once at import time; subsequent calls return cached string
3. Model name reads from `MODEL_NAME` env var with fallback to `claude-sonnet-4-20250514`
4. Token usage logs show cache_read_input_tokens > 0 on second+ turn of a session

**Files to modify:**
- `backend/tarini/agent.py`
- `backend/tarini/prompts/__init__.py`

---

## Phase 7: Reliability & Client Lifecycle

**Goal:** Fix history trimming to respect message alternation, add timeout to Anthropic stream calls, and make the Anthropic client a singleton.

**Requirements:** RELY-01, RELY-02, RELY-03

**Success Criteria:**
1. `_trim_history_for_api()` never produces a history that starts with `assistant` or has consecutive same-role messages
2. Anthropic stream call has a 60-second timeout; on timeout, yields `{"type": "error", "message": "..."}` and breaks cleanly
3. `anthropic.AsyncAnthropic` is instantiated once at module level (or lazily on first use), not per `stream_chat()` call
4. Existing SSE event format is unchanged (no frontend breakage)

**Files to modify:**
- `backend/tarini/agent.py`

---

## Phase 8: Data Integrity Fixes

**Goal:** Fix JSON injection in tool error responses and make stage+state updates atomic.

**Requirements:** DATA-01, DATA-02

**Success Criteria:**
1. All tool error responses in `tools/__init__.py` use `json.dumps()` instead of f-string interpolation
2. `advance_stage` uses an atomic RPC (or single transaction) that updates both `stage` and validates state consistency
3. No f-string JSON construction anywhere in `backend/tarini/tools/`
4. A concurrent `update_state` + `advance_stage` in the same turn cannot produce inconsistent state

**Files to modify:**
- `backend/tarini/tools/__init__.py`
- `backend/tarini/db/client.py`
- Supabase: new or updated RPC function

---

## Phase Summary

| Phase | Name | Requirements | Files |
|-------|------|-------------|-------|
| 6 | Cost & Configuration Optimization | COST-01, COST-02, CONF-01 | agent.py, prompts/__init__.py |
| 7 | Reliability & Client Lifecycle | RELY-01, RELY-02, RELY-03 | agent.py |
| 8 | Data Integrity Fixes | DATA-01, DATA-02 | tools/__init__.py, db/client.py |

---
*Roadmap created: 2026-04-03*
*Last updated: 2026-04-03 after initial creation*
