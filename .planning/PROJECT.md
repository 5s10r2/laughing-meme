# Tarini Agent

## What This Is

Tarini is a conversational AI agent that onboards Indian rental property operators onto RentOK. Operators describe their property through natural chat (English, Hindi, Hinglish), and Tarini collects, validates, and persists structured listing data across 5 stages. The frontend renders generative UI components inline in chat via an `emit_ui` tool.

## Core Value

Every downstream RentOK feature (rent collection, lease management, occupancy tracking) depends on accurate property data captured in this conversation. Getting the onboarding right is not optional.

## Current Milestone: v1.1 Backend Hardening

**Goal:** Fix 8 identified issues in the backend AI agent — prompt caching, client lifecycle, history trimming, error handling, and configuration hygiene. No new features.

**Target fixes:**
- Fix prompt caching (move cache_control to system prompt block)
- Model as environment variable
- Fix history trimming to respect message alternation
- Singleton Anthropic client
- Cache system prompt at module load
- Add timeout to Anthropic stream call
- Fix JSON injection in error responses
- Atomic stage+state update

## Requirements

### Validated

- v1.0: Full 5-stage conversational onboarding (intro, structure, packages, mapping, verification)
- v1.0: 28 generative UI components rendered inline via emit_ui tool
- v1.0: SSE streaming with keepalive bridge pattern
- v1.0: Conversation persistence across server restarts (Supabase JSONB)
- v1.0: Sliding window for API cost control
- v1.0: In-memory fallback when Supabase unreachable

### Active

- [ ] Fix prompt caching to actually reduce input token costs
- [ ] Make AI model configurable via environment variable
- [ ] Fix history trimming to maintain valid message alternation
- [ ] Singleton Anthropic client to reuse HTTP connections
- [ ] Cache system prompt at module load instead of reading from disk per turn
- [ ] Add timeout to Anthropic API stream calls
- [ ] Fix JSON injection vulnerability in tool error responses
- [ ] Atomic stage+state database update to prevent corruption

### Out of Scope

- New product features (gender preference, security deposit, lock-in period) — deferred to v1.2
- Photo capture flow — deferred to v1.2+
- Test coverage — separate milestone
- CORS/auth/rate limiting hardening — separate milestone
- Frontend changes — backend only

## Context

- Backend: Python 3.12 / FastAPI / uvicorn on Render free tier (512MB RAM)
- AI: Direct `anthropic` Python SDK, model `claude-sonnet-4-20250514`
- Database: Supabase Postgres with atomic RPC for state updates
- System prompt: 562 lines (~4K tokens), loaded from `system_prompt.md`
- All 8 fixes are in `backend/` — specifically `tarini/agent.py`, `tarini/tools/__init__.py`, `tarini/db/client.py`, `tarini/prompts/__init__.py`

## Constraints

- **Infrastructure**: Render free tier, 512MB RAM — no heavy dependencies
- **Scope**: Backend only, no frontend changes
- **Backwards compatibility**: SSE event format must not change (frontend depends on it)
- **Deployment**: Changes must work on Render without config changes beyond env vars

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct Anthropic SDK over Agent SDK | Agent SDK CLI subprocess OOMed on Render 512MB | ✓ Good |
| State as source of truth (not conversation history) | Enables sliding window without losing captured data | ✓ Good |
| System prompt in markdown file | Easier to iterate on prompt without code changes | ✓ Good |
| SSE queue-bridge with keepalives | Prevents proxy timeout during tool execution | ✓ Good |

---
*Last updated: 2026-04-03 after milestone v1.1 initialization*
