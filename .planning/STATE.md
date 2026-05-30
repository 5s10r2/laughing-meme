# State

## Current Position

Milestone: Backend domain redesign — Phase A
Status: **Phase A complete** (A1–A5 + A7), all flag-gated behind `USE_NEW_EXPERIENCE`
Branch: `backend/domain-redesign` (PR #2, base retargeted to `main`)
Last activity: 2026-05-30 — A1–A7 built, 142 tests passing

## Project Reference

See: .planning/PROJECT.md · backend/docs/redesign/

**Core value:** Accurate property data capture through conversational onboarding
**Current focus:** New intent/command engine, built behind a flag; `main` (round-2) stays live

## Phase A — backend redesign (done)

| Step | Commit | Delivers |
|------|--------|----------|
| A1 | d9cc4d1 | Golden conversation flows (eval safety net) |
| A2 | 3c597e6 | SupabasePropertyRepository + migration 0002 |
| A3 | 17e7acf | get_model / apply_commands tools + command codec |
| A4 | b17dc27 | Thin prompt (~65 lines) + live-context renderer |
| A5 | 8442a6e | Server rewire behind USE_NEW_EXPERIENCE + UI adapter |
| A7 | 3b3216f | Funnel observability |

Pre-existing spine (P0/P1): domain aggregate, commands, invariants, completeness, PublishGateway stub.

## Accumulated Context

- New path is fully isolated: own tables (property_snapshots, command_log), separate code path,
  legacy `stream_chat` untouched. Flag off (default) = verified baseline runs.
- 142 tests, no live model/DB needed (FakeSupabase reproduces the CAS; fake Anthropic client
  drives the v2 SSE loop).
- SSE contract preserved; UI adapter projects the new model → legacy OnboardingState shape so the
  EXISTING frontend renders the new backend with the flag on.

## Before flipping the flag (prod)

1. Apply backend/db/migrations/0002_property_redesign.sql to Supabase.
2. Set USE_NEW_EXPERIENCE=true; confirm TARINI_API_KEY.
3. OPEN BLOCKER: real RentOK publish contract (isolated behind PublishGateway; stub carries UAT).

## Next

- Phase B: port the Living Blueprint storybook to React; retarget the UI adapter to the new
  components; then flip the flag (new look + new IA together).
- Optional: in-memory CommandService idempotency cache is unbounded (low risk; cleanup later).
