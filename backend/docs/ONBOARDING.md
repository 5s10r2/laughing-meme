# Tarini Agent — Onboarding Guide

> Generated from knowledge graph · Commit `acadb801` · 2026-04-09

Tarini is a conversational AI agent that onboards Indian rental property operators onto RentOK. No forms — operators describe their property in natural chat (English, Hindi, or Hinglish), and Tarini collects, validates, and persists structured listing data across a 5-stage journey.

---

## Table of Contents

1. [Who Uses Tarini (PM)](#1-who-uses-tarini-pm)
2. [Business Domains & Flows](#2-business-domains--flows)
3. [End-to-End Journey](#3-end-to-end-journey)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Layers](#5-architecture-layers)
6. [Local Development Setup](#6-local-development-setup)
7. [Guided Code Tour](#7-guided-code-tour)
8. [File Map](#8-file-map)
9. [Design Patterns](#9-design-patterns)
10. [How to Add a Feature](#10-how-to-add-a-feature)
11. [Complexity Hotspots](#11-complexity-hotspots)
12. [Deployment](#12-deployment)
13. [Testing Guide (QA)](#13-testing-guide-qa)
14. [Role-Specific Checklists](#14-role-specific-checklists)

---

## 1. Who Uses Tarini (PM)

### User Persona — Property Operator

| Attribute | Description |
|---|---|
| Who | Independent PG/hostel/apartment owners onboarding to RentOK |
| Language | English, Hindi, or Hinglish (code-switched mid-sentence) |
| Device | Mobile browser, often on slow connections |
| Goal | Get their property listed on RentOK without filling forms |
| Pain point | Traditional listing forms are long, confusing, and unforgiving |

### What Tarini Replaces

Instead of a multi-step form wizard, the operator has a conversation. Tarini asks questions in sequence, confirms answers, and persists structured data behind the scenes. At no point does the operator interact with a form field.

### The 5-Stage Onboarding Journey

```
intro → structure → packages → mapping → verification
```

| Stage | What Tarini collects |
|---|---|
| **intro** | Greets operator, explains the process, creates session |
| **structure** | Floors, rooms, room naming convention |
| **packages** | Rental package names and monthly pricing |
| **mapping** | Which rooms belong to which packages |
| **verification** | Operator reviews all collected data and confirms |

Each stage is atomic — Tarini won't advance until the current stage's data is complete and confirmed.

---

## 2. Business Domains & Flows

### Domains

| Domain | Responsibility |
|---|---|
| **Operator Onboarding** | 5-stage journey, stage gating, property state mutations |
| **AI Conversation** | Anthropic Claude streaming loop, tool-use, SSE events |
| **Session Persistence** | Supabase Postgres, message history, concurrent-write safety |
| **Generative UI** | Push rich UI components (StageTransitionCard etc.) over SSE |

### How They Interact

```
AI Conversation ──(get_state/update_state/advance_stage)──▶ Operator Onboarding
AI Conversation ──(emit_ui tool)───────────────────────────▶ Generative UI
AI Conversation ──(read/write history)─────────────────────▶ Session Persistence
Operator Onboarding ──(atomic Supabase RPC)────────────────▶ Session Persistence
Generative UI ──(reads STAGE_ORDER/STAGE_LABELS)───────────▶ Operator Onboarding
```

### Key Flows

| Flow | Entry Point | Description |
|---|---|---|
| **Start Session** | `POST /sessions` | Creates a new Supabase session row, returns UUID |
| **Process Chat Turn** | `POST /sessions/{id}/chat` | Full LLM loop — receives message, streams SSE response |
| **Resume Session** | `GET /sessions/{id}` | Returns current stage + state for frontend restore |
| **Stage Progression** | `advance_stage` tool | Validates + atomically writes new stage to DB, emits UI event |
| **Property Data Collection** | `get_state`/`update_state` tools | Read current state, extract fields from chat, deep-merge + persist |
| **Local Dev CLI** | `python main.py` | Interactive terminal loop for testing without running FastAPI |

---

## 3. End-to-End Journey

```
Operator opens RentOK onboarding page
        │
        ▼
Frontend: POST /sessions → get session UUID
        │
        ▼
Frontend: POST /sessions/{id}/chat (initial greeting)
        │
        ▼
server.py receives message
        │
        ├── SessionManager loads/creates history from Supabase
        │
        └── agent.py: stream_chat()
                │
                ├── Calls Anthropic API (streaming, system prompt injected)
                │
                ├── Claude emits text deltas → streamed as SSE 'text' events
                │
                ├── Claude calls tools mid-stream:
                │     ├── get_state → reads current property state
                │     ├── update_state → deep-merges new fields into Supabase
                │     ├── advance_stage → atomically moves to next stage
                │     └── emit_ui → pushes StageTransitionCard to frontend
                │
                └── After all tool rounds: persist history, emit 'done' SSE

Frontend renders streamed text + UI components in real time
```

### Data Dependency Chain

```
Session (UUID) must exist before any chat turn
Stage must be valid before advance_stage can move forward
State fields from prior stages persist across all subsequent turns
Message history is loaded on every turn before calling Claude
```

---

## 4. Tech Stack

| Layer | Technology | Version | Hosting |
|---|---|---|---|
| HTTP Server | FastAPI + Uvicorn | 0.115 / 0.29 | Render free tier (Singapore) |
| AI | Anthropic Claude Sonnet | `claude-sonnet-4-20250514` | Anthropic API |
| Database | Supabase Postgres | — | Supabase |
| Streaming | Server-Sent Events (SSE) | — | — |
| Runtime | Python | 3.12.0 | — |
| Deps | pydantic, python-dotenv, supabase SDK | — | — |
| Frontend | Next.js (separate repo) | — | Vercel |

---

## 5. Architecture Layers

### Layer 1 — API Layer

Entry surface for all HTTP traffic. Intentionally thin — all business logic is delegated immediately.

| File | Role |
|---|---|
| `main.py` | CLI dev entry point; also the uvicorn bootstrap for local testing |
| `server.py` | FastAPI app with 3 endpoints; SSE streaming with keepalive bridge |

### Layer 2 — Agent Core

The Anthropic SDK loop and session state management.

| File | Role |
|---|---|
| `tarini/agent.py` | `stream_chat()` — the tool-use loop; history trimming; SSE event emission |
| `tarini/session_manager.py` | LRU-cached session histories; asyncio locks; 30-min idle eviction |
| `tarini/stage_ui.py` | `STAGE_ORDER`, `STAGE_LABELS`; `build_transition_event()` for StageTransitionCard SSE |

### Layer 3 — Agent Tools

What Claude can actually do. Each tool maps directly to an Anthropic tool definition.

| File | Role |
|---|---|
| `tarini/tools/__init__.py` | `TOOL_DEFINITIONS` (JSON schemas Claude sees); `execute_tool()` dispatcher |
| `tarini/tools/state.py` | `get_state`, `update_state`, `advance_stage` implementations |
| `tarini/tools/ui.py` | `emit_ui` tool; `AVAILABLE_COMPONENTS` allowlist (20 components); validator |

### Layer 4 — Prompts

The behavioral specification. This is as important as any code file.

| File | Role |
|---|---|
| `tarini/prompts/system_prompt.md` | 564-line prompt: Tarini's persona, all 5 stages, tool-use rules, Hindi/Hinglish handling |
| `tarini/prompts/__init__.py` | Loads `.md` at import time; exposes `SYSTEM_PROMPT`, `INITIAL_PROMPT` |

### Layer 5 — Data Layer

All persistence flows through here.

| File | Role |
|---|---|
| `tarini/db/client.py` | Supabase async client singleton; 6 operations; in-memory fallback for local dev |
| `tarini/db/schema.sql` | `sessions` table + 2 atomic PL/pgSQL RPCs for race-free state writes |

### Layer 6 — Infrastructure & Config

| File | Role |
|---|---|
| `render.yaml` | Render.com service config (build, start command, env vars, health check) |
| `Procfile` | `web: uvicorn server:app ...` for Railway/Heroku-compatible hosts |
| `requirements.txt` | Pinned Python dependencies |
| `runtime.txt` | `python-3.12.0` |
| `.env.example` | Template: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

---

## 6. Local Development Setup

### Prerequisites

- Python 3.12
- A Supabase project (free tier works) — or run without one (in-memory fallback activates automatically)
- An Anthropic API key

### Steps

```bash
# 1. Clone and enter the backend directory
cd tarini-agent/backend

# 2. Create a virtual environment
python -m venv .venv && source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
# (Leave SUPABASE vars blank to use in-memory fallback for local testing)

# 5a. Run the HTTP server (production code path)
uvicorn server:app --reload --port 8000

# 5b. OR run the CLI (no FastAPI needed)
python main.py
```

### In-Memory Fallback

If `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are absent or the DB is unreachable, `tarini/db/client.py` automatically falls back to a local `_mem_sessions` dict. Sessions won't persist across restarts but the full agent loop works.

### Key Environment Variables

| Variable | Where Used | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | `tarini/agent.py` | Yes |
| `SUPABASE_URL` | `tarini/db/client.py` | No (uses memory fallback) |
| `SUPABASE_SERVICE_KEY` | `tarini/db/client.py` | No (uses memory fallback) |

---

## 7. Guided Code Tour

Start here if you're new to the codebase. Read files in this order:

### Step 1 — Application Entry Point
**`main.py`** · Moderate complexity

The server process starts here. `uvicorn.run(app)` with the `if __name__ == '__main__'` guard means the same `app` object can be imported for testing without side effects. Also doubles as a CLI dev loop via the Claude Agent SDK.

### Step 2 — FastAPI Server & SSE Endpoints
**`server.py`** · Complex

Three endpoints: `POST /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/chat`. The third is the critical path — it returns a `StreamingResponse` using `_stream_with_keepalives()`, an async generator that proxies from an `asyncio.Queue` while injecting periodic keepalive frames to prevent proxy timeouts during long tool executions.

### Step 3 — Agent Core Loop & Stage Navigation
**`tarini/agent.py`** · Complex | **`tarini/stage_ui.py`** · Simple

`stream_chat()` is the heart. It runs the Anthropic tool-use loop up to `MAX_TOOL_ROUNDS`, yielding typed SSE event dicts: `text`, `tool_start`, `tool_complete`, `component`, `state_snapshot`, `done`. `stage_ui.py` is imported here for `build_transition_event()` — it holds `STAGE_ORDER` and `STAGE_LABELS`, the canonical source of truth for stage ordering.

### Step 4 — Tarini's Behavioral Specification
**`tarini/prompts/system_prompt.md`** · Complex | **`tarini/prompts/__init__.py`** · Simple

Read this before any tool code. The 564-line system prompt defines Tarini's persona, which tool to call at each stage, how to handle Hindi/Hinglish, and error recovery protocols. The `__init__.py` loader reads it from disk at import time — meaning prompt changes deploy without code changes.

### Step 5 — Session History Management
**`tarini/session_manager.py`** · Moderate

HTTP is stateless; conversation is not. `SessionManager` (a module-level singleton) keeps an LRU cache of message histories keyed by session UUID, with asyncio locks to serialise concurrent requests to the same session, and writes through to Supabase after every turn.

### Step 6 — Tool Definitions & Dispatcher
**`tarini/tools/__init__.py`** · Moderate

`TOOL_DEFINITIONS` is the JSON schema array Claude sees. These descriptions directly influence when Claude chooses to call each tool — they're part of the model's reasoning surface. `execute_tool()` is the dispatcher Claude's output routes through.

### Step 7 — State Tool Implementations
**`tarini/tools/state.py`** · Moderate

`get_state`, `update_state`, `advance_stage`. `update_state` does a recursive deep-merge so partial field updates don't clobber previously collected data. `advance_stage` validates against `VALID_STAGES` before calling the atomic Supabase RPC.

### Step 8 — Generative UI Tool
**`tarini/tools/ui.py`** · Simple

`emit_ui` lets Claude request any of 20 predefined UI components by name. The `validate_emit_ui()` function guards the allowlist. The serialised result is yielded as a `component` SSE event the frontend renders in real time.

### Step 9 — Database Client & Operations
**`tarini/db/client.py`** · Complex | **`.env.example`**

The Supabase singleton. Six operations: `create_session`, `get_session`, `load_messages`, `save_messages`, `update_session_state`, `advance_stage`. Automatic in-memory fallback when credentials are missing. Atomic RPCs prevent read-modify-write races under concurrency.

### Step 10 — Sessions Schema
**`tarini/db/schema.sql`** · Moderate

The single `sessions` table: `id`, `stage`, `state` (JSONB), `messages` (JSONB array), `state_version` (optimistic lock counter), `user_id`. Two PL/pgSQL RPCs — `update_session_state_atomic` and `advance_stage_atomic` — eliminate concurrent-write corruption at the DB layer.

### Step 11 — Dependencies & Runtime
**`requirements.txt`** | **`runtime.txt`**

Pin Python 3.12.0 and exact package versions. First thing to check when setting up a new environment.

### Step 12 — Deployment Configuration
**`Procfile`** | **`render.yaml`**

Render.com is the production host. `render.yaml` configures the service (Python env, pip build, `uvicorn server:app` start, `/health` health check, three env var references). `Procfile` provides Railway/Heroku compatibility with the same uvicorn command.

---

## 8. File Map

```
backend/
├── main.py                    # Entry point (CLI dev loop + uvicorn bootstrap)
├── server.py                  # FastAPI app — 3 HTTP endpoints, SSE streaming
├── requirements.txt           # Pinned Python deps
├── runtime.txt                # python-3.12.0
├── Procfile                   # web: uvicorn server:app (Railway/Heroku)
├── render.yaml                # Render.com service config
├── .env.example               # Env var template
│
└── tarini/
    ├── agent.py               # Anthropic tool-use streaming loop (core)
    ├── session_manager.py     # In-process LRU session cache + Supabase write-through
    ├── stage_ui.py            # STAGE_ORDER, STAGE_LABELS, build_transition_event()
    │
    ├── prompts/
    │   ├── __init__.py        # Loads system_prompt.md → SYSTEM_PROMPT constant
    │   └── system_prompt.md   # 564-line behavioral spec (read this first!)
    │
    ├── tools/
    │   ├── __init__.py        # TOOL_DEFINITIONS + execute_tool() dispatcher
    │   ├── state.py           # get_state, update_state, advance_stage
    │   └── ui.py              # emit_ui + AVAILABLE_COMPONENTS allowlist
    │
    └── db/
        ├── client.py          # Supabase async singleton + in-memory fallback
        └── schema.sql         # sessions table + 2 atomic PL/pgSQL RPCs
```

---

## 9. Design Patterns

### Tool-Use Loop Pattern

Claude doesn't call tools directly — it emits tool-use blocks in its response. The loop in `agent.py` catches these, dispatches them via `execute_tool()`, appends results back to the message history, and re-calls Claude. This repeats until Claude returns a final text-only response or `MAX_TOOL_ROUNDS` is hit.

```
Claude response → tool_use block → execute_tool() → result → back into messages → Claude again
```

### Prompt-as-Config Pattern

`system_prompt.md` is loaded at runtime, not compiled in. This means prompt iteration (fixing Tarini's behavior, adding edge cases) requires no code changes — just edit the `.md` and redeploy.

### In-Memory + DB Dual-Mode Pattern

`tarini/db/client.py` checks for Supabase credentials at startup. If absent, it activates a `_mem_sessions` dict. All callers use the same interface — the fallback is invisible. This makes local dev frictionless.

### Atomic State Versioning Pattern

Every `update_session_state` call increments `state_version` in the same Postgres transaction via PL/pgSQL RPC. Concurrent writes don't corrupt — the last writer wins on the version number and the state is always consistent.

### SSE Keepalive Bridge Pattern

Proxy servers (Render, Vercel edge) kill SSE connections that go silent for >30s. `_stream_with_keepalives()` in `server.py` uses an `asyncio.Queue` + `asyncio.wait()` (not `wait_for`, to avoid timeout races) to inject `data: {"type":"thinking"}` frames every 15s while the agent is processing.

---

## 10. How to Add a Feature

### Add a New Tool for the Agent

1. **Define the schema** in `tarini/tools/__init__.py` — add to `TOOL_DEFINITIONS`. Write the description carefully; Claude reads it.
2. **Add the dispatch case** in `execute_tool()` in the same file.
3. **Implement the function** in `tarini/tools/state.py` (state tools) or `tarini/tools/ui.py` (UI tools) or a new file.
4. **Update the system prompt** in `tarini/prompts/system_prompt.md` — tell Tarini when and how to use the new tool.
5. Test via `python main.py` (CLI) before HTTP integration.

### Add a New Onboarding Stage

1. Add the stage name to `STAGE_ORDER` in `tarini/stage_ui.py`.
2. Add a label to `STAGE_LABELS` and optionally `STAGE_DESCRIPTIONS`.
3. Update `VALID_STAGES` in `tarini/tools/state.py`.
4. Add the stage's data schema to the `sessions.state` JSONB expectations and document it.
5. Update `tarini/prompts/system_prompt.md` with instructions for the new stage.

### Add a New Generative UI Component

1. Add the component name to `AVAILABLE_COMPONENTS` in `tarini/tools/ui.py`.
2. Define the props schema expected by the frontend.
3. Update `system_prompt.md` to tell Tarini when to emit it.
4. Implement the React component in the frontend repo.

### Change Tarini's Behavior

Edit `tarini/prompts/system_prompt.md` only. No Python changes required. Test with `python main.py`.

---

## 11. Complexity Hotspots

| File | Complexity | Why |
|---|---|---|
| `tarini/agent.py` | **Complex** | Interleaved streaming + tool-use + SSE emission + history management in a single async generator. Race conditions possible if `MAX_TOOL_ROUNDS` logic changes. |
| `server.py` | **Complex** | `asyncio.Queue` + `asyncio.wait()` keepalive bridge is subtle. `asyncio.wait_for` was deliberately avoided — don't reintroduce it. |
| `tarini/db/client.py` | **Complex** | Dual-mode (Supabase/memory), async initialization, 6 operations, atomic RPC calls. Test against both modes when changing. |
| `tarini/prompts/system_prompt.md` | **Complex** | 564 lines of behavioral rules. Changes here affect all conversation flows — regression-test all 5 stages after edits. |

---

## 12. Deployment

### Production (Render.com)

```
render.yaml → pip install -r requirements.txt → uvicorn server:app --host 0.0.0.0 --port $PORT
```

Health check: `GET /health` (returns `{"status": "ok"}`).

Required env vars on Render dashboard:
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Alternative (Railway)

Use `railway.json` + `Procfile`. Same env vars. Singapore region recommended for Indian operator latency.

### Supabase Setup

Run `tarini/db/schema.sql` against your Supabase project SQL editor to create:
- `sessions` table
- `update_session_state_atomic` RPC
- `advance_stage_atomic` RPC

---

## 13. Testing Guide (QA)

### Test Infrastructure

No automated test suite exists yet. The primary testing surface is the CLI loop (`python main.py`) and manual HTTP testing.

### Critical Flows by Priority

**P0 — Financial / Data Integrity**
- Stage progression is atomic — confirm `state_version` increments correctly and concurrent `advance_stage` calls don't corrupt stage
- `update_state` deep-merge preserves previously collected fields — verify no overwrite on partial updates
- Session history persists across process restarts (requires Supabase; won't test with memory fallback)

**P1 — Core Conversational Flow**
- Full 5-stage onboarding completes end-to-end: intro → structure → packages → mapping → verification
- Hindi and Hinglish input is accepted and data is extracted correctly
- Stage transitions emit `StageTransitionCard` SSE event with correct labels

**P2 — Operational**
- SSE connection stays alive during long tool executions (>30s) — keepalive frames appear
- `GET /sessions/{id}` correctly restores frontend state for a mid-session refresh
- In-memory fallback activates correctly when Supabase credentials are absent
- `MAX_TOOL_ROUNDS` limit is respected — agent does not loop indefinitely

### Test Data Setup

```bash
# 1. Create a session
curl -X POST http://localhost:8000/sessions | jq .

# 2. Send a chat message
curl -X POST http://localhost:8000/sessions/{SESSION_ID}/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi, I want to list my PG"}' \
  --no-buffer

# 3. Resume a session
curl http://localhost:8000/sessions/{SESSION_ID}
```

### Testing with Memory Fallback (No Supabase)

Remove `SUPABASE_URL` from `.env`. The DB client prints a warning and uses `_mem_sessions`. Use `python main.py` for the fastest feedback loop — no HTTP overhead.

### Testing Prompt Changes

```bash
# Edit system_prompt.md, then:
python main.py
# The prompt reloads automatically (no restart needed)
```

---

## 14. Role-Specific Getting Started

### For PMs

1. Read [§1 Who Uses Tarini](#1-who-uses-tarini-pm) and [§3 End-to-End Journey](#3-end-to-end-journey)
2. Read `tarini/prompts/system_prompt.md` — this is the product spec
3. Run `python main.py` and have a conversation as an operator
4. Review [§2 Business Domains & Flows](#2-business-domains--flows) to understand what each flow does

### For Developers

1. Complete [§6 Local Development Setup](#6-local-development-setup)
2. Read [§7 Guided Code Tour](#7-guided-code-tour) in order — all 12 steps
3. Run `python main.py`, complete a full 5-stage onboarding
4. Read [§9 Design Patterns](#9-design-patterns) before writing any code
5. Check [§11 Complexity Hotspots](#11-complexity-hotspots) before touching those files

### For QA

1. Complete [§6 Local Development Setup](#6-local-development-setup)
2. Read [§13 Testing Guide](#13-testing-guide-qa) in full
3. Run all P0 flows manually first — data integrity is the highest risk
4. Test with and without Supabase credentials (both modes must work)
5. Test Hindi/Hinglish input explicitly — it's a stated product requirement
