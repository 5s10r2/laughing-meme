# Tarini Backend — Architecture Audit

**Date:** 2026-05-30 · **Scope:** backend only · **Method:** full code read (every module)
**Out of scope (deferred by decision):** Lifecycle/multi-property, i18n.

This is the fact base for the target architecture spec (`02-ARCHITECTURE.md`). It maps
what exists today, grounds each maturity gap in actual code, and lists what the redesign
**must preserve**.

---

## 1. Current architecture (as-is)

### Request flow
```
Browser ─► Next.js /api/chat (Edge proxy: Bearer header, SSE passthrough)
        ─► FastAPI POST /sessions/{id}/chat   (server.py)
        ─► _stream_with_keepalives            (asyncio.Queue bridge + 2s keepalives)
        ─► session_manager.chat               (query_lock, history load + persist-on-finally)
        ─► agent.stream_chat                  (Anthropic streaming + tool-use loop)
        ─► SSE events ─► frontend
```

### Modules
| File | Responsibility |
|---|---|
| `server.py` | FastAPI app, SSE endpoint, Bearer auth (`require_auth`), CORS, keepalive queue-bridge, `_cancel_task` |
| `session_manager.py` | Per-session in-memory history cache, `query_lock` (one turn/session), idle eviction, **persist via tracked background task awaited in cleanup** |
| `agent.py` | `stream_chat` — Anthropic stream, tool loop (`MAX_TOOL_ROUNDS=10`), sliding-window history (`_MAX_API_HISTORY=20`, "state IS the memory"), emits `text / tool_start / tool_complete / component / state_snapshot / done`; `_safe_execute_tool` wraps tool calls |
| `tools/state.py` | `get_state`, `update_state` (deep-merge, **arrays overwrite**), `advance_stage` (linear validate) |
| `tools/ui.py` | `validate_emit_ui` against `AVAILABLE_COMPONENTS` (20 legacy components); returns `{rendered:true}` |
| `tools/__init__.py` | `TOOL_DEFINITIONS` (Anthropic tool schemas) + `execute_tool` 4-branch dispatch |
| `state_schema.py` | Pydantic `OnboardingState` (StrictModel) + `STATE_UPDATE_SCHEMA` (JSON schema for `update_state`) |
| `prompts/system_prompt.md` | ~570-line system prompt (persona + 5-stage protocol + tool docs + emit_ui prop shapes) |
| `db/client.py` | Supabase client + in-memory fallback, `_with_retry`, `_call_rpc` (atomic RPCs) |
| `stage_ui.py` | Builds `StageTransitionCard` events |
| `main.py` | Local CLI harness |

### State model
One `OnboardingState` per session, persisted on the `sessions` row as:
`state` (jsonb) · `messages` (jsonb) · `stage` (text) · `state_version` (int).
Shape: `user_name, property_name, property_type, property_location, gender_preference,
floors[], units[], packages[], naming_patterns{}`.
Mutations go through Supabase RPCs `update_session_state_atomic` / `advance_stage_atomic`.

### Tools (4)
- `get_state()` → `{stage, state, state_version}`
- `update_state(updates)` → **`_deep_merge`; dicts merge, lists are *overwritten*** (state.py)
- `advance_stage(stage)` → validates against linear `VALID_STAGES`
- `emit_ui(component, props)` → validates name vs 20 legacy components; **props are authored by the LLM**

---

## 2. Findings by dimension (grounded)

**Domain model — L2.** `units[]` is a flat array; rooms are not individually addressable for
granular ops. Invariants ("a room maps to ≤1 package", "active package needs a rent",
"naming regenerates when floors change") exist only as **prose in the prompt** + a couple of
ad-hoc checks. Because `_deep_merge` overwrites arrays, **editing one of N units requires the
LLM to resend all N** — O(N) tokens per edit, error-prone at 100–240 rooms.
*Evidence:* `tools/state.py::_deep_merge` ("Lists are overwritten"); `state_schema.UnitState`.

**Action/tool surface — L2.** A single blunt write tool. No granular, transactional, or
idempotent operations. The LLM constructs whole arrays and authors UI props directly.
*Evidence:* `execute_tool`; `update_state`; `emit_ui` passthrough.

**Interaction / IA — L2.** `advance_stage` enforces linear `intro→structure→packages→mapping→
verification`; the prompt adds hard gates ("never advance with one field missing"). No concept
of *direct UI edits* or *talk-or-touch reconciliation*. Conflicts with the approved IA
(any-order, persistent editable model). *Evidence:* system prompt stage gates; `VALID_STAGES`.

**Prompt architecture — L3.** Genuinely strong persona/policy (owner-centric, mobile-concise,
real tenant questions), but **monolithic (~570 lines)**, embeds **exact component prop JSON**,
and encodes **domain rules as prose** (unenforceable). *Evidence:* `system_prompt.md` emit_ui
section.

**Generative-UI contract — L2.** `AVAILABLE_COMPONENTS` = the 20 **legacy** components being
replaced by the Living Blueprint system. Props are LLM-authored and mirrored in the prompt →
double drift risk with the new design. *Evidence:* `tools/ui.py`.

**Reliability / streaming — L3.** Solid: keepalive bridge, persist-on-finally (fixed this
session), `_with_retry`, `_STREAM_TIMEOUT=60`, `MAX_TOOL_ROUNDS=10`, `_safe_execute_tool`.
Gaps: no resumable turn; partial-tool-failure handling is minimal.

**State integrity / concurrency — L2.** `state_version` exists and `query_lock` serializes
turns per session, but the version is **not used to reject stale writes** (no optimistic
concurrency). Two writers (chat + direct UI edit) are not modeled — they will race.
*Evidence:* `db/client.py` RPCs return version but callers ignore it.

**Quality / eval — L2.** 52 unit tests added this session, but **no conversation/flow eval
harness** — no way to confirm a prompt/tool change didn't break a real flow.

**Observability — L3.** Per-round token logging exists; no tracing, no funnel/drop-off, no
cost dashboard.

**Persistence / schema — RISK.** The DB schema and the atomic RPCs (`update_session_state_atomic`,
`advance_stage_atomic`) live **only in Supabase** — no `.sql`/migrations in the repo. Not
version-controlled, not reproducible, not reviewable. *Evidence:* `find backend -name '*.sql'`
→ none.

**Security — L3.** Bearer auth + coherent CORS added this session. Unmitigated: prompt-injection
(user chat text can attempt to steer system behavior), no rate limiting, client-supplied
`session_id` (fixation surface noted earlier).

---

## 3. Invariants currently unenforced (must become code)
1. A unit maps to at most one package.
2. An active package must have a starting rent before publish.
3. `naming_patterns` must regenerate unit names when floors/counts change.
4. Stage/completeness must be derivable from data, not a free-floating pointer.
5. `package` cannot be deleted while units map to it.
6. Floor/unit/package IDs must be stable and unique.

---

## 4. Constraints the redesign MUST preserve
- **SSE event contract** the frontend consumes: `text, tool_start, tool_complete, component,
  state_snapshot, quick_replies, thinking, error, done`.
- **Session persistence + reconnection** ("state is memory" sliding window).
- **Supabase + in-memory fallback** (`ALLOW_IN_MEMORY_DB`).
- The **disconnect-persist fix** (tracked task awaited in `cleanup`).
- **Bearer auth** + env config.
- The **52 passing unit tests** (extend, don't regress).

---

## 5. Deferred (explicit)
- Lifecycle / multi-property (return edits, multiple properties, re-onboard).
- i18n / Hinglish.

→ Next: `02-ARCHITECTURE.md` — target design, domain aggregate, command catalog, invariants,
prompt architecture, completeness engine, eval harness, and the migration path from this code.
