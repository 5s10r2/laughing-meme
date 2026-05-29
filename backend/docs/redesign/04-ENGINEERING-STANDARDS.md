# Tarini Backend — Engineering Standards (clean by construction)

Architecture style: **Hexagonal (Ports & Adapters) + DDD-lite.** The domain core is pure and
framework-free; all I/O (Anthropic, Supabase, FastAPI/SSE, RentOK) lives behind ports at the
edges. This is what keeps the codebase clean, modular, testable, and swappable.

---

## 1. Module layout (dependencies point INWARD; domain depends on nothing)

```
backend/tarini/
  domain/            # PURE — no anthropic/supabase/fastapi imports, no I/O
    property.py        # Property aggregate + Block/Floor/Room/Package entities (typed, IDs)
    commands.py        # Command types (immutable typed intents)
    invariants.py      # invariant rules (pure functions)
    completeness.py    # completeness derivation (pure)
    errors.py
  application/        # use-cases (domain + ports only)
    command_service.py # validate → apply → version → idempotency; returns model+completeness+warnings
    session_service.py # turn/history orchestration
  ports/             # Protocol interfaces
    repository.py      # load/save snapshot + append command log
    publish_gateway.py # RentOK publish (open question #1 lives behind this)
    llm.py             # model-agnostic LLM client
  adapters/          # port implementations (the only place with I/O)
    supabase_repository.py · inmemory_repository.py · anthropic_llm.py · rentok_publish.py(stub)
  agent/
    prompt/  core.md · references/*.md · builder.py   # composes stable core + dynamic ctx + JIT refs
    loop.py            # stream_chat tool loop
    tools.py           # tool defs ↔ command translation (get_model · apply_commands · emit_ui · ask)
    ui_adapter.py      # (intent, model) → component props  ← cohesion guarantee
  api/  server.py · routes_chat.py · routes_commands.py · sse.py
  obs/  logging.py · funnel.py · cost.py
  config.py
  tests/  domain/ · application/ · adapters/ · flows/(golden) · contract/(SSE)
  db/migrations/*.sql
```

Rule: `domain` imports nothing outward. `application` imports `domain` + `ports`. `adapters`,
`agent`, `api` import inward only. No cycles.

---

## 2. Code standards
- **Full type hints**; `pyright`/`mypy` strict. Pydantic **only at boundaries** (API/LLM/DB);
  domain uses plain typed models, pure.
- **Domain purity:** zero framework/I/O imports in `domain/`. Invariants are pure functions.
- **Small units:** target ≤ ~250–300 lines/file, small single-purpose functions. A growing file
  is a signal to split.
- **No silent failures:** explicit errors; no bare `except`; results carry `warnings[]`. (We'll
  run the silent-failure check.)
- **No dead code, no back-compat shims, minimal comments** (only non-obvious *why*). Per global
  coding standards.
- **Immutability where natural:** commands are immutable; aggregate mutations are explicit.
- **Ubiquitous language:** names match the domain (`Property`, `Floor`, `Room`, `map_rooms`).
- **Validate only at boundaries** (user input, RentOK, DB); trust the core.

---

## 3. Testing standards
- **domain/** — pure, fast, near-exhaustive on invariants.
- **application/** — command_service against `inmemory_repository`.
- **adapters/** — contract/round-trip tests.
- **flows/** — golden conversation evals (happy · messy/non-linear · mid-flow edit ·
  10-floor/240-room · conflicting info · corrections · reconnection · publish-gating · chat-only).
- **contract/** — SSE event-shape regression (frontend depends on it).
- Extend the existing 52 tests; never regress them.

---

## 4. Tooling & gates
- **ruff** (lint + format) · **pyright/mypy** (strict) · **pytest** (+asyncio).
- Pre-commit + CI gate per phase: **lint + types + tests + golden evals all green** before merge.
- Each phase reviewed with the quality skills before merge:
  `pr-review-toolkit:code-reviewer` · `code-simplifier` (`/simplify`) · `silent-failure-hunter`
  · `type-design-analyzer` · `/code-review`. (Same discipline as the Thermos-style review.)

---

## 5. Definition of clean (acceptance)
Domain compiles & tests with **no infra imports**; every adapter swappable behind its port;
no file over the size budget without justification; lint/types/tests/evals green; the agent
touches state only through `application.command_service`. If any of these fail, the phase isn't done.
