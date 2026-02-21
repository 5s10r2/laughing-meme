# Tarini Agent — Technical Architecture Overview

> **One-liner:** AI-powered property onboarding chatbot for RentOK, built with Claude Agent SDK (Python) + FastAPI + Next.js + Supabase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Project Structure](#3-project-structure)
4. [Data Flow](#4-data-flow)
5. [API Endpoints](#5-api-endpoints)
6. [Database Schema](#6-database-schema)
7. [MCP Tools Reference](#7-mcp-tools-reference)
8. [Session Lifecycle](#8-session-lifecycle)
9. [System Prompt Summary](#9-system-prompt-summary)
10. [Environment Variables](#10-environment-variables)
11. [Key Design Decisions](#11-key-design-decisions)

---

## 1. Project Overview

**Tarini** is a conversational AI agent that guides Indian rental property operators through the onboarding process on RentOK. Instead of forms, operators describe their property in natural conversation (English, Hindi, or Hinglish), and Tarini collects, validates, and persists the structured data.

### Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| AI Engine  | Claude Agent SDK (Python) + Anthropic API |
| Model      | `claude-sonnet-4-20250514`          |
| Backend    | FastAPI + Uvicorn (Python 3.11+)    |
| Frontend   | Next.js 16 + React 19 + Tailwind 4 |
| Database   | Supabase (PostgreSQL)               |
| Streaming  | Server-Sent Events (SSE)            |
| Deployment | Railway (backend) + Vercel (frontend) |

### Core Principle

> The system prompt IS the product. The code is infrastructure to deliver it.

The 353-line `system_prompt.md` defines Tarini's character, expertise, conversation rules, and onboarding logic. Everything else — FastAPI, MCP tools, SSE streaming, the chat UI — is infrastructure that lets that prompt operate reliably with persistent state.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (User)                               │
│                   Next.js Chat UI (port 3000)                       │
│   ┌──────────────┐  ┌──────────────┐                                │
│   │ ChatUI.tsx   │  │ localStorage │  session_id persisted here     │
│   │  (SSE parse) │  │              │                                │
│   └──────┬───────┘  └──────────────┘                                │
│          │                                                          │
│   ┌──────▼──────────────────┐                                       │
│   │  /api/session (proxy)   │  POST → backend /sessions             │
│   │  /api/chat    (proxy)   │  POST → backend /sessions/{id}/chat   │
│   └──────┬──────────────────┘                                       │
└──────────┼──────────────────────────────────────────────────────────┘
           │ HTTP / SSE
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    FASTAPI SERVER (port 8000)                        │
│                                                                      │
│  ┌─────────────────────┐     ┌──────────────────────────────┐       │
│  │   server.py         │────▶│   SessionManager (singleton) │       │
│  │   4 endpoints       │     │   _clients: {sid → Client}   │       │
│  │   SSE streaming     │     │   _connect_locks: per-session │       │
│  └─────────────────────┘     │   _query_locks:   per-session │       │
│                               └──────────┬───────────────────┘       │
│                                          │                           │
│                               ┌──────────▼───────────────────┐       │
│                               │   ClaudeSDKClient            │       │
│                               │   (one per active session)   │       │
│                               │                              │       │
│                               │   ┌────────────────────────┐ │       │
│                               │   │  system_prompt.md      │ │       │
│                               │   │  (353 lines — Tarini)  │ │       │
│                               │   └────────────────────────┘ │       │
│                               │                              │       │
│                               │   ┌────────────────────────┐ │       │
│                               │   │  In-Process MCP Server │ │       │
│                               │   │  3 tools (closure-     │ │       │
│                               │   │  bound to session_id)  │ │       │
│                               │   └───────────┬────────────┘ │       │
│                               └───────────────┼──────────────┘       │
│                                               │                      │
│                                    ┌──────────▼──────────┐           │
│                                    │  Anthropic API      │           │
│                                    │  (claude-sonnet-4)  │           │
│                                    └─────────────────────┘           │
│                                               │                      │
│                               ┌───────────────▼──────────────┐       │
│                               │     Supabase (PostgreSQL)    │       │
│                               │     sessions table (JSONB)   │       │
│                               └──────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

```
tarini-agent/
├── doc.md                              # This file — architecture overview
├── documentation.md                    # Complete developer recreation guide
│
├── backend/
│   ├── server.py                       # FastAPI app — 4 endpoints, SSE streaming (172 lines)
│   ├── main.py                         # CLI entry point for development testing (136 lines)
│   ├── requirements.txt                # Python dependencies (6 packages)
│   ├── Procfile                        # Railway deployment command
│   ├── .env                            # Environment variables (gitignored)
│   ├── .gitignore                      # Protects .env, __pycache__, .tarini_session
│   │
│   └── tarini/
│       ├── __init__.py                 # Package marker
│       ├── agent.py                    # ClaudeAgentOptions factory (43 lines)
│       ├── session_manager.py          # Per-session client lifecycle + dual locks (95 lines)
│       │
│       ├── prompts/
│       │   ├── __init__.py             # load_system_prompt() helper (8 lines)
│       │   └── system_prompt.md        # Tarini's character + expertise + rules (353 lines)
│       │
│       ├── tools/
│       │   ├── __init__.py             # MCP server factory (13 lines)
│       │   └── state.py               # 3 MCP tools + deep merge utility (186 lines)
│       │
│       └── db/
│           ├── schema.sql              # Supabase table + indexes + trigger (48 lines)
│           └── client.py               # Supabase client singleton + async wrappers (121 lines)
│
└── frontend/
    ├── package.json                    # Next.js 16.1.6, React 19.2.3, Tailwind 4
    ├── next.config.ts                  # Next.js configuration (empty defaults)
    ├── tsconfig.json                   # TypeScript strict mode, bundler resolution
    ├── postcss.config.mjs              # Tailwind 4 PostCSS plugin
    ├── .env.local                      # BACKEND_URL=http://localhost:8000
    │
    └── app/
        ├── layout.tsx                  # Root layout — Geist fonts, page metadata (35 lines)
        ├── page.tsx                    # Root page — renders <ChatUI /> (5 lines)
        ├── globals.css                 # Tailwind 4 import + dark/light theme vars (27 lines)
        │
        ├── components/
        │   └── ChatUI.tsx              # Full chat interface with SSE streaming (323 lines)
        │
        └── api/
            ├── session/
            │   └── route.ts            # Proxy: POST → backend /sessions (21 lines)
            └── chat/
                └── route.ts            # Proxy: POST → backend SSE stream passthrough (35 lines)
```

**Total lines of code:** ~1,210 (backend ~820 + frontend ~390), of which 353 are the system prompt.

---

## 4. Data Flow

What happens when a user sends a message:

| Step | Component | Action |
|------|-----------|--------|
| 1 | **ChatUI.tsx** | User types message, hits Enter. `sendMessage()` is called. |
| 2 | **ChatUI.tsx** | Adds user bubble + empty Tarini bubble (streaming). Calls `streamChat()`. |
| 3 | **/api/chat/route.ts** | Next.js API route proxies POST to `BACKEND_URL/sessions/{id}/chat`. |
| 4 | **server.py** | FastAPI receives request, acquires session's query lock. |
| 5 | **session_manager.py** | `get_or_create_client()` returns existing client or creates new one (with `resume=sdk_session_id` if available). |
| 6 | **ClaudeSDKClient** | `client.query(message)` sends the user message to Anthropic API. Claude processes it using the system prompt and available MCP tools. |
| 7 | **tools/state.py** | Claude may call `get_state`, `update_state`, or `advance_stage`. Each tool reads/writes Supabase via `db/client.py`. |
| 8 | **server.py** | `receive_response()` async iterator yields `AssistantMessage` and `ResultMessage`. Text blocks are wrapped as SSE events: `data: {"type": "text", "text": "..."}`. |
| 9 | **ChatUI.tsx** | `streamChat()` async generator reads SSE chunks, yields text. React state updates append each chunk to the Tarini bubble in real time. |

**Opening greeting flow:** When a session first loads, `ChatUI` sends an empty message. The backend converts this to a prompt telling Tarini to call `get_state` and greet the user based on their progress.

---

## 5. API Endpoints

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| `POST` | `/sessions` | Create a new onboarding session | — | `{"session_id": "uuid"}` (201) |
| `GET` | `/sessions/{id}` | Get session state (for frontend restore) | — | `{id, stage, state, state_version, created_at, updated_at}` |
| `POST` | `/sessions/{id}/chat` | Send message, stream Tarini's response | `{"message": "text"}` | SSE stream |
| `GET` | `/health` | Health check | — | `{"status": "ok"}` |

### SSE Event Format

```
data: {"type": "text", "text": "Hi! I'm Tarini..."}
data: {"type": "text", "text": " Let's get started."}
data: {"type": "done"}
```

On error:
```
data: {"type": "error", "message": "Session not found"}
```

---

## 6. Database Schema

### `sessions` Table

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | UUID | `gen_random_uuid()` | Primary key — Supabase session ID |
| `user_id` | TEXT | NULL | Multi-user ready (unused in V1) |
| `sdk_session_id` | TEXT | NULL | Claude SDK session ID for conversation resumption |
| `stage` | TEXT | `'intro'` | Current onboarding stage |
| `state` | JSONB | `'{}'` | All property data as flexible JSON |
| `state_version` | INTEGER | `1` | Monotonic counter — incremented on every `update_state` |
| `created_at` | TIMESTAMPTZ | `NOW()` | Row creation time |
| `updated_at` | TIMESTAMPTZ | `NOW()` | Auto-updated via trigger |

### Indexes

- `idx_sessions_user_id` on `user_id`
- `idx_sessions_sdk_id` on `sdk_session_id`

### JSONB State Structure (Example)

```json
{
  "user_name": "Ramesh",
  "property_name": "Sunrise PG",
  "property_type": "pg",
  "property_location": "Koramangala, Bangalore",
  "floors": [
    { "index": 0, "label": "Ground Floor", "active": true },
    { "index": 1, "label": "1st Floor", "active": true }
  ],
  "units": [
    {
      "id": "unit_001", "name": "Room 101", "floor_index": 0,
      "category": "pg_room", "sharing_type": "double",
      "package_id": "pkg_001", "active": true
    }
  ],
  "packages": [
    {
      "id": "pkg_001", "name": "AC Double Sharing",
      "category": "pg_room", "sharing_type": "double",
      "furnishing": "fully_furnished",
      "amenities": ["AC", "WiFi", "attached washroom"],
      "starting_rent": 9000, "active": true
    }
  ]
}
```

### Valid Stages (Ordered)

`intro` → `structure` → `packages` → `mapping` → `verification`

---

## 7. MCP Tools Reference

All 3 tools are registered under the `tarini` MCP server namespace, exposed as `mcp__tarini__<name>`.

| Tool | Purpose | Input | When Called |
|------|---------|-------|------------|
| `get_state` | Read current stage + all saved property data | None | Start of every session, before any response. Also on "what have you saved?" queries. |
| `update_state` | Deep-merge confirmed data into session state | `{"updates": {...}}` — only changed fields | After user explicitly confirms a piece of information. |
| `advance_stage` | Move to the next onboarding stage | `{"stage": "structure"}` | When all requirements for current stage are met and user confirms. |

### Tool Return Format

All tools return MCP-compliant responses:

```json
{
  "content": [{"type": "text", "text": "{...JSON...}"}]
}
```

On error: adds `"is_error": true` to the response.

### Closure Pattern

Tools are created via `build_state_tools(session_id)` — a factory function that returns tool instances with `session_id` captured in the closure. This means Claude never needs to pass `session_id` as an argument; each tool automatically knows which session it operates on.

---

## 8. Session Lifecycle

### Two IDs

| ID | Source | Purpose |
|----|--------|---------|
| **Supabase Session ID** | `gen_random_uuid()` in PostgreSQL | Our primary key. Used in all API routes, stored in browser `localStorage`. |
| **SDK Session ID** | `ResultMessage.session_id` from Claude Agent SDK | Claude's internal conversation ID. Passed as `resume=` to continue conversations across server restarts. |

### New Session Flow

1. Frontend calls `POST /sessions` → Supabase creates row → returns UUID
2. Frontend stores UUID in `localStorage.tarini_session_id`
3. Frontend sends empty message to `POST /sessions/{id}/chat`
4. Backend creates `ClaudeSDKClient` (no `resume=` since new)
5. Claude calls `get_state` → sees empty state → sends greeting
6. `ResultMessage` yields `sdk_session_id` → backend persists it to Supabase

### Resumption Flow

1. Frontend reads UUID from `localStorage`, sends message
2. Backend reads `sdk_session_id` from Supabase row
3. Creates `ClaudeSDKClient(options=build_options(session_id, sdk_session_id=...))`
4. The `resume=sdk_session_id` parameter restores the full conversation history
5. Claude calls `get_state`, sees existing data, continues naturally

### Concurrency Model

The `SessionManager` uses two levels of `asyncio.Lock` per session:

- **Connect lock** (`_connect_locks`): Prevents multiple concurrent `ClaudeSDKClient` creations for the same session.
- **Query lock** (`_query_locks`): Serializes `query()` + `receive_response()` pairs so two browser tabs can't interleave messages on the same session.

---

## 9. System Prompt Summary

The 353-line `system_prompt.md` defines everything about Tarini. Key sections:

| Section | Lines | Purpose |
|---------|-------|---------|
| Character | 1–19 | Warm, patient, expert persona. Never robotic. |
| Language Rules | 21–30 | Auto-mirrors Hindi/English/Hinglish. Never asks language preference. |
| Tool Documentation | 32–114 | Exact usage rules for all 3 tools + state schema. |
| Conversation Rules | 116–141 | 11 non-negotiable rules: one question per turn, confirm before saving, etc. |
| Error Recovery | 143–154 | 3-strike protocol: retry → acknowledge → offer choices. Never pretend a save worked. |
| Proactive Quality | 156–165 | Like a sharp human: catches missing rents, unmapped rooms, dangling packages. |
| Stage 1: Structure | 173–214 | Floors, unit types, naming patterns. PG/hostel/flat domain knowledge. |
| Stage 2: Packages | 216–245 | Rental offerings: sharing + furnishing + amenities + starting rent. |
| Stage 3: Mapping | 247–273 | Connect units to packages. Bulk commands, safety guards. |
| Stage 4: Verification | 275–294 | Final review, completion checks, next steps. |
| Never List | 296–309 | Hard boundaries: no tech jargon, no false saves, no bullet dumps. |
| Session Start | 311–333 | Fresh vs returning user greeting logic. |

---

## 10. Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Direct Anthropic API key for Claude access |
| `SUPABASE_URL` | Supabase project URL (`https://<project>.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Supabase service role JWT (bypasses RLS) |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | FastAPI backend URL. Default: `http://localhost:8000` |

---

## 11. Key Design Decisions

### Why JSONB for state?

The property data schema is still evolving through real-world testing. JSONB lets us iterate on the state structure purely through system prompt changes — no migrations needed. The plan is to normalize into relational tables in V2 once the data model stabilizes.

### Why in-process MCP (not subprocess)?

The Claude Agent SDK supports both external MCP servers (running as separate processes) and in-process servers via `create_sdk_mcp_server()`. We use in-process because:
- Zero subprocess overhead
- Tools share the same Python process and event loop
- Direct access to `asyncio.to_thread()` for Supabase calls
- No IPC serialization latency

### Why SSE instead of WebSocket?

- SSE is simpler — works over standard HTTP, no upgrade handshake
- One-directional streaming (server → client) is exactly what we need
- Next.js API routes can proxy `ReadableStream` bodies natively
- No WebSocket library dependencies on either side

### Why the Next.js proxy pattern?

The frontend API routes (`/api/session`, `/api/chat`) proxy to the Python backend. This provides:
- Same-origin requests (no CORS issues in production)
- A natural place to add authentication later without changing the frontend
- Clean separation: frontend never talks directly to Python

### Why `asyncio.to_thread()` for Supabase?

The `supabase-py` client is synchronous. Rather than introducing `httpx` or a custom async client, we wrap sync calls with `asyncio.to_thread()`. This is simple, reliable, and doesn't block the FastAPI event loop.

### Why `bypassPermissions`?

The Claude Agent SDK normally prompts the user for permission before tool execution. For a server-side agent where tools are trusted and controlled, we set `permission_mode="bypassPermissions"` so tools run autonomously without interactive permission dialogs.

### Why a per-session `ClaudeSDKClient`?

Each `ClaudeSDKClient` maintains a persistent subprocess connection to the Claude CLI. This connection holds the conversation context and MCP tool bindings. We keep one alive per active session so that follow-up messages within the same session don't need to re-initialize — they just call `query()` on the existing client.

### Why monotonic `state_version`?

A simple incrementing counter on every `update_state` call gives us:
- A lightweight indicator that state has changed
- Protection against stale-state overwrites in future multi-device scenarios
- Easy debugging: "version 7 means there have been 7 saves"
