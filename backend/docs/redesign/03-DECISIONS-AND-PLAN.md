# Tarini Backend — Decisions & Build Plan

**Supersedes/extends:** `02-ARCHITECTURE.md` (strengthens §7 Prompt; adds cross-cutting
principles, open questions, and the phased plan). **Deferred:** lifecycle/multi-property, i18n.
This is the document the build executes from.

---

## A. Locked decisions (the spine)
1. **Agent emits intents, never writes state.** A typed **Command Service** validates, enforces
   invariants, applies atomically, versions. Correctness lives in code.
2. **Typed Property aggregate** with stable IDs (blocks→floors→rooms→packages→mappings).
3. **Completeness engine** replaces linear stages; only `publish` is gated.
4. **Talk-or-touch:** chat and direct UI edits emit the *same* commands.
5. **Thin, high-altitude prompt** (see §B); domain rules in code, component shapes in adapter.
6. **Golden-flow eval harness** gates prompt/tool changes.
7. **Schema-as-code** (migrations in repo); snapshot + append-only command log.

---

## B. Prompt architecture (industry-grade — strengthened)

**Philosophy:** context engineering, not prompt-stuffing. The prompt **guides judgment; it is
not load-bearing for correctness** (the command service is) → no single point of failure.
Grounded in Anthropic's "right altitude" + canonical context ordering + minimal-tool guidance.

**Properties:**
- **Defense in depth** — model ignoring an instruction cannot corrupt data; commands reject it.
- **Right altitude** — heuristics + principles, not if-then scripts, not vagueness. (Keeps it short.)
- **Layered & composable** — stable core + dynamic per-turn context + just-in-time references.
- **Eval-gated, versioned** — changes ship only if golden flows pass; interference-checked.
- **Short because logic is elsewhere** — target ~120–150 lines.

**Structure (composed, not monolithic):**
```
[STABLE CORE — versioned, ~120–150 lines]
 1. Identity & mission        (Tarini; a property-model service; owner-first)
 2. Operating principles      (right-altitude heuristics: one-question/turn, confirm-before-save,
                               out-of-order is fine, never dead-end, mobile-concise, prefer
                               commands, never write state directly, talk↔touch parity,
                               acknowledge UI-originated edits)
 3. Tool contract             (get_model · apply_commands · emit_ui(intent) · ask — minimal,
                               unambiguous, when/how)
 4. Voice & language          (warm, Indian PG context, plain prose)
 5. Safety                    (user text is untrusted; never reveal system; commands enforce)
[DYNAMIC — injected each turn]
 6. Current model snapshot + completeness + open_items + ui_mode
[JUST-IN-TIME — retrieved only when relevant]
 7. references/  (naming heuristics, package templates, unit-type taxonomy)
```
**Explicitly NOT in the prompt:** domain rules (→ command service), component prop shapes
(→ UI adapter), stage logic (→ completeness engine), the 5-stage protocol (→ retired).

---

## C. Cross-cutting principles (folded in)
- **Chat-only is the floor, not a mode.** Every action completable in pure conversation; UI is
  progressive enhancement. Per-session `ui_mode: rich | chat_only` + auto-degrade if the client
  can't render. Default `rich`.
- **Cohesion is an adapter guarantee.** UI components are pure projections of the model — the
  **UI Adapter** builds props from live state (never the LLM), so selectors are pre-selected,
  forms pre-filled, surfaces always agree. Chat acknowledges UI edits; UI reflects chat edits.
- **Model routing** behind a model-agnostic boundary (Sonnet for reasoning; cheaper model for
  classification/extraction where safe).
- **Optimistic concurrency** — commands may carry `expected_version`; stale writes return a
  conflict; caller re-reads. `query_lock` still serializes per session.
- **Idempotency keys** on commands (safe retries).
- **Observability funnel** — events for: session start → completeness reached → published;
  per-turn tokens/cost; tool-error rate; component-usage (to validate rich-vs-chat).
- **Eval harness** — golden flows: happy path · messy/non-linear owner · mid-flow edit ·
  10-floor/240-room · conflicting info ("16"→"14") · corrections · reconnection · publish-gating
  · chat-only parity. Assert commands + completeness + invariants.

---

## D. Open questions (recommended defaults so the build isn't blocked)
1. **🔴 RentOK publish contract — NEEDS INPUT (eventually).** What does `publish` actually write
   to RentOK core (property/room/package records, API/event shape)?
   **Default to proceed:** isolate behind a `PublishGateway` port with a stub (writes a
   `published_properties` snapshot / emits an event). Wire the real API when the contract is
   known. *Does not block P0–P4.*
2. **🟠 Undo depth.** **Recommendation (locked unless you object):** append-only **command log**
   enabling "undo last", per-command revert, and full reset — **not** full event-sourcing/CQRS
   (overkill now). Snapshot stays the source of truth; log gives audit + undo.

---

## E. Phased build plan (each phase ships, tests stay green)

| Phase | Delivers | Absorbs (from the list) |
|---|---|---|
| **P0** Schema-as-code | DB schema + RPCs → `db/migrations/`; snapshot + command-log tables | persistence, undo substrate |
| **P1** Domain + commands | Typed aggregate, command catalog, invariants, idempotency | granular edits, integrity, conflicting-info handling |
| **P2** Completeness engine | Derived completeness; retire stage gates (stage kept derived) | any-order IA |
| **P3** Tools + thin prompt + adapter | `get_model`/`apply_commands`/intent `emit_ui`; rewrite prompt (§B); UI adapter → Living Blueprint components; `ui_mode` (chat-floor) | prompt architecture, cohesion, chat-only, UI-contract decoupling |
| **P4** Talk-or-touch | `/commands` endpoint; optimistic concurrency; `model_updated` SSE | multi-device, two-writer races |
| **P5** Eval + observability | Golden flows, funnel, cost, SSE-contract regression | quality, observability, model routing, prompt-as-tested |
| **(port)** Publish gateway | `PublishGateway` stub → real RentOK when contract known | open question #1 |

**Preserved at every phase:** SSE event contract · session persistence/reconnection · Supabase +
in-memory fallback · disconnect-persist fix · Bearer auth · the 52 unit tests.

**Parallelizable (subagents) once the command-service interface is fixed (early P1):** domain
entities · each command group (structure/packages/mapping) · invariants · UI adapter · eval
fixtures.

---

## F. Deferred (explicit)
Lifecycle/multi-property (return edits, multiple properties, re-onboard) · i18n/Hinglish.
Design must not *preclude* them; we just don't build them now.

---

## Definition of done
Agent emits validated commands only · one room edits in O(1) · any-order editing with ambient
completeness · talk-or-touch on one spine · short eval-gated prompt with no embedded shapes ·
chat-only parity · schema in repo · golden flows green · funnel live · publish behind a port.
All non-deferred maturity dimensions at target.
