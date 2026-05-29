# Tarini Backend — Target Architecture

**Companion to:** `01-AUDIT.md` · **Deferred:** lifecycle/multi-property, i18n.
This is the design we build against. It is incremental: every phase ships, tests stay green,
and the SSE contract + session persistence are preserved throughout.

---

## 0. Principle

Tarini is a **conversational property-model service**, not an onboarding wizard. There is one
**living, typed domain object** — the Property — that the owner co-edits by **talking or
touching**, in **any order**, forever. The agent never writes raw state; it expresses
**intents** that a domain service validates and applies. Correctness lives in **code**, not in
prompt prose.

---

## 1. Target architecture (layers)

```
            Owner
   chat  ◄──┴──►  direct UI edits
     │             │            both express the SAME intents
     ▼             ▼
  Agent (thin prompt)      UI event → /sessions/{id}/commands
     │  apply_commands([…])         │
     └──────────────┬───────────────┘
                    ▼
        ┌────────────────────────────┐
        │  Command Service            │  validate · enforce invariants ·
        │  (the spine)                │  apply atomically · version · idempotency
        └────────────┬───────────────┘
                     ▼
        Property Aggregate (typed)  ──►  Postgres/Supabase (schema-as-code)
                     │                    snapshot + command log
                     ▼
        Completeness Engine  (derived: what's done / what's left)
                     │
                     ▼
        UI Adapter  (model → component props)  ──► Living Blueprint components
        ───────────────────────────────────────────────────────────────
        Observability (trace, funnel, cost)  ·  Eval harness (golden flows)
```

---

## 2. Domain model — the Property aggregate

Typed, ID-addressable, invariant-enforced. (Pydantic models; one aggregate per session.)

```
Property
  id, owner_name, name, type, location, gender_preference
  blocks: [ Block{ id, label } ]                 # ≥1; single-block properties have one implicit block
  floors: [ Floor{ id, block_id, index, label, active } ]
  rooms:  [ Room{ id, floor_id, name, type, sharing, package_id?, status } ]   # status: active|unavailable
  packages: [ Package{ id, name, sharing, ac, food, furnishing, amenities[], rent, active } ]
  naming_patterns: { floor_id|"all": { pattern, start } }
  version: int
```

**Enforced invariants (in the aggregate / command service, not prose):**
1. Every `Room.package_id` references an existing active package (or is null).
2. A room maps to ≤1 package (it's a scalar field — structurally enforced).
3. `publish` requires: every active package has `rent`; every active room is mapped or
   explicitly `unavailable`; required property fields present.
4. Changing a floor's count/naming regenerates room names from `naming_patterns`.
5. A package with mapped rooms cannot be deleted (must disable, or remap first).
6. IDs are stable + unique; deletes cascade with guards.

Why IDs matter: granular edits become O(1) ("set rent on `pkg_3`", "map `room_311..314` to
`pkg_2`") instead of resending whole arrays.

---

## 3. Command catalog — the intent API (the spine)

Both the agent (`apply_commands`) and the UI (`POST /commands`) emit these. Each is validated,
applied atomically, bumps `version`, and returns `{ok, model, completeness, warnings[]}`.
Commands are **idempotent where natural** and **batchable** (several in one transaction).

| Group | Command | Args |
|---|---|---|
| Property | `set_property` | `{name?, type?, location?, gender?, owner_name?}` |
| Structure | `add_floors` | `{count} | {range:[a,b]} | {labels:[…]}` (→ creates Floor ids) |
| | `rename_floor` | `{floor_id, label}` |
| | `remove_floor` | `{floor_id}` (cascade rooms, guarded) |
| | `set_floor_rooms` | `{floor_id, count, type_mix?}` (create/adjust Room ids) |
| | `set_room_type` | `{room_ids[], type, sharing?}` |
| | `rename_room` | `{room_id, name}` |
| | `set_naming_pattern` | `{scope: floor_id|"all", pattern, start}` (regenerates names) |
| Packages | `create_package` | `{name, sharing, ac, food, furnishing, rent, amenities?}` |
| | `update_package` | `{package_id, …fields}` (propagates to mapped rooms) |
| | `disable_package` / `delete_package` | `{package_id}` (delete guarded) |
| Mapping | `map_rooms` | `{room_ids[], package_id}` |
| | `unmap_rooms` / `mark_unavailable` | `{room_ids[]}` |
| Lifecycle | `publish` | `{}` (gated by invariant #3) |

Read path: `get_model()` → typed aggregate + completeness (replaces `get_state`).

---

## 4. Agent tool surface (new — replaces the 4 blunt tools)

- **`get_model()`** — current aggregate + completeness + open items.
- **`apply_commands(commands: [...])`** — batch of intents, applied transactionally; returns
  the new model + completeness + warnings. (Replaces `update_state` and `advance_stage`.)
- **`emit_ui(intent, ref)`** — e.g. `emit_ui("floor_detail", {floor_id})`. The **UI Adapter**
  builds the actual props from the model. The LLM no longer authors prop JSON.
- **`ask(quick_replies[])`** — optional, for offering tap options.

This shrinks LLM responsibility to *reasoning + intent*, with correctness guaranteed downstream.

---

## 5. Completeness engine (replaces stages)

Derived purely from the model:
```
completeness = {
  property:  complete | partial | empty,
  structure: …,  packages: …,  mapping: …,
  open_items: [ "Floor 6 has no rooms", "AC Double has no rent", "4 rooms unmapped" ],
  publishable: bool
}
```
The agent reads this and nudges the most valuable next step — but the owner may work any facet
in any order. Only `publish` is gated. The legacy `stage` field is kept **derived** during
migration for back-compat, then retired.

---

## 6. Talk-or-touch

A direct UI edit (tap floor → change rooms in a sheet) `POST`s the **same command** to
`/sessions/{id}/commands`. Same validation, same versioning. The change emits a
`state_snapshot` (or `model_updated`) on the live SSE so chat stays in sync, and the agent sees
it via `get_model` on its next turn. **Concurrency:** optimistic — commands may carry
`expected_version`; a stale write returns a conflict and the caller re-reads. `query_lock`
still serializes per session.

---

## 7. Prompt architecture (thin)

Target ~150 lines: **persona + conversation policy + tool contract + completeness-aware
guidance.** Removed from the prompt:
- Domain rules → enforced by command service.
- Component prop JSON → owned by UI Adapter.
- Naming/package heuristics → externalized `references/*.md`, pulled only when relevant
  (or kept as a short policy section).

Keeps the genuinely strong parts (owner voice, mobile concision, confirm-before-save,
out-of-order is fine, never dead-end).

---

## 8. Generative-UI contract

`ui_adapter.py` maps `(intent, ref, model) → {component, props}` for the **Living Blueprint**
components (Massing, FloorLedger, FloorDetailSheet[empty/filled], PackageEditor, MappingPicker,
VerificationSummary, …). Single source of truth for prop shapes; versioned alongside the
components. The agent and prompt reference **intents**, never shapes.

---

## 9. Persistence & schema-as-code

- Extract the existing Supabase schema + RPCs into **`db/migrations/*.sql`** (version-controlled,
  reviewable, reproducible).
- Persist a **snapshot** of the aggregate + an append-only **command log** (gives history,
  auditability, and a path to undo later).
- Keep Supabase + in-memory fallback.

---

## 10. Reliability, observability, eval, security

- **Reliability:** keep keepalive bridge, persist-on-finally, retries, stream timeout; add
  partial-tool-failure surfacing and command-level idempotency keys.
- **Observability:** structured logs → traces per turn; a **funnel** (sessions → completeness
  reached → published) and per-turn token/cost. This is how we'll *see* where owners stall.
- **Eval harness (`tests/flows/`):** golden conversation fixtures —
  happy path · messy/non-linear owner · mid-flow edit · 10-floor / 240-room · corrections ·
  reconnection · publish-gating. Assert **commands emitted + completeness + invariants**, run
  on every prompt/tool change. This is the line between demo and industry-grade.
- **Security:** keep Bearer auth; add basic rate limiting; treat chat text as untrusted
  (prompt-injection guardrails — the command service is the real protection, since the LLM
  can't write state directly); server-issued session ownership.

---

## 11. Migration path (incremental, each phase ships green)

- **P0 — Schema-as-code.** Pull DB schema + RPCs into `db/migrations/`. No behavior change.
- **P1 — Domain core + command service.** Typed aggregate + command catalog + invariants.
  Route the existing `update_state` through it (adapter) so nothing breaks yet. Unit-tested.
- **P2 — Completeness engine.** Replace `advance_stage` logic; keep `stage` derived. Any-order
  editing enabled.
- **P3 — New tool surface + thin prompt.** `get_model` / `apply_commands` / intent-based
  `emit_ui`; rewrite prompt; wire UI Adapter to Living Blueprint components.
- **P4 — Talk-or-touch.** `/commands` endpoint + optimistic concurrency + `model_updated` SSE.
- **P5 — Eval harness + observability.** Golden flows, funnel, cost.

SSE contract, session persistence, auth, and the 52 unit tests are preserved at every step.

---

## 12. Build parallelization (for execution)

Independent, spec-defined modules that can be built concurrently by subagents then integrated:
domain entities · each command group (structure / packages / mapping) · invariants · UI adapter ·
eval fixtures. The command service interface is the contract that lets them be built in parallel.

---

## Definition of done (industry-grade, this milestone)
The agent emits validated commands only; one room edits in O(1); any-order editing with ambient
completeness; talk-or-touch hit the same spine; thin prompt with no embedded shapes; schema in
the repo; golden-flow evals green; the 5 deferred-dimension fixes (domain, action, IA, prompt,
UI-contract, integrity, eval, observability, security) all at target. Lifecycle + i18n
explicitly deferred.
