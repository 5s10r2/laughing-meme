# Phase 6: Cost & Configuration Optimization — Plan

**Created:** 2026-04-03
**Requirements:** COST-01, COST-02, CONF-01

## Tasks

### Task 1: Cache system prompt at module load (COST-02)
**File:** `backend/tarini/prompts/__init__.py`
- Change `load_system_prompt()` to read file once at import time and cache the result
- Subsequent calls return the cached string

### Task 2: Fix prompt caching for Anthropic API (COST-01)
**File:** `backend/tarini/agent.py`
- Change `system` parameter from a plain string to a list with a single content block that has `cache_control`
- Format: `system=[{"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}}]`
- Remove the top-level `cache_control` from the `messages.stream()` call

### Task 3: Model as environment variable (CONF-01)
**File:** `backend/tarini/agent.py`
- Change `MODEL = "claude-sonnet-4-20250514"` to read from `os.environ.get("MODEL_NAME", "claude-sonnet-4-20250514")`

## Verification
- System prompt cached: `load_system_prompt()` returns same object on repeated calls
- Prompt caching: `system` param is a list with cache_control block
- Model config: `MODEL` reads from env var with default
