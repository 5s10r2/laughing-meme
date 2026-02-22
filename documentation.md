# Tarini Agent — Complete Developer Recreation Guide

> **Last updated:** 2026-02-22
> **Architecture version:** 2.0 (Direct Anthropic API — no Claude Agent SDK)

This document is a step-by-step guide to recreate the Tarini agent from scratch. Every file, every line of code, every configuration detail is here. If this repo disappeared tomorrow, you could rebuild the entire system using only this guide.

For architecture decisions, deployment notes, and project state, see `memory.md`.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Database Setup (Supabase)](#4-database-setup-supabase)
5. [Backend — Python / FastAPI](#5-backend--python--fastapi)
   - 5.1 [Configuration Files](#51-configuration-files)
   - 5.2 [Database Client](#52-database-client)
   - 5.3 [System Prompt](#53-system-prompt)
   - 5.4 [Tool Definitions & Dispatcher](#54-tool-definitions--dispatcher)
   - 5.5 [Tool Implementations (State)](#55-tool-implementations-state)
   - 5.6 [Agent (Streaming Tool-Use Loop)](#56-agent-streaming-tool-use-loop)
   - 5.7 [Session Manager](#57-session-manager)
   - 5.8 [FastAPI Server](#58-fastapi-server)
6. [Frontend — Next.js](#6-frontend--nextjs)
   - 6.1 [Configuration Files](#61-configuration-files)
   - 6.2 [API Routes (Proxy)](#62-api-routes-proxy)
   - 6.3 [Chat UI Component](#63-chat-ui-component)
   - 6.4 [Layout & Styles](#64-layout--styles)
7. [Deployment](#7-deployment)
   - 7.1 [Backend on Render](#71-backend-on-render)
   - 7.2 [Frontend on Vercel](#72-frontend-on-vercel)
8. [Data Flow — End to End](#8-data-flow--end-to-end)
9. [Key Gotchas & Lessons Learned](#9-key-gotchas--lessons-learned)

---

## 1. System Overview

Tarini is a conversational AI agent that onboards Indian rental property operators on RentOK. No forms — operators describe their property in natural chat (English, Hindi, Hinglish), and Tarini collects, validates, and persists structured listing data.

**Architecture:**

```
┌─────────────┐       ┌────────────────┐       ┌──────────────┐       ┌──────────┐
│   Browser    │──SSE──│  Next.js (Edge)│──SSE──│  FastAPI      │──────│ Supabase │
│   (React)    │       │  Vercel        │       │  Render       │      │ Postgres │
└─────────────┘       └────────────────┘       │               │      └──────────┘
                                                │  Anthropic SDK│
                                                │  ↕ Claude API │
                                                └──────────────┘
```

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 | Vercel |
| Backend | Python 3.12, FastAPI, uvicorn | Render free tier (Singapore) |
| AI | Direct `anthropic` Python SDK, model: `claude-sonnet-4-20250514` | Anthropic API |
| Database | Supabase Postgres | Supabase |

---

## 2. Prerequisites

- Python 3.12
- Node.js 20+
- npm or yarn
- Supabase account (free tier works)
- Anthropic API key
- Render account (for backend deployment)
- Vercel account (for frontend deployment)

---

## 3. Project Structure

```
tarini-agent/
  memory.md                           # Architecture decisions, project state
  documentation.md                    # This file — full recreation guide

  backend/
    server.py                         # FastAPI app, SSE streaming with keepalive bridge
    runtime.txt                       # python-3.12.0
    render.yaml                       # Render service config
    requirements.txt                  # Python dependencies
    tarini/
      __init__.py                     # (empty)
      agent.py                        # Streaming tool-use loop, _serialize_content helper
      session_manager.py              # Per-session history, Supabase persistence, eviction
      prompts/
        __init__.py                   # load_system_prompt(), INITIAL_PROMPT
        system_prompt.md              # 354-line behavioral prompt (character, stages, tools)
      tools/
        __init__.py                   # TOOL_DEFINITIONS (3 tools), execute_tool dispatcher
        state.py                      # get_state, update_state, advance_stage
      db/
        __init__.py                   # (empty)
        client.py                     # Supabase async client: sessions CRUD, messages
        schema.sql                    # Reference DDL (sessions table + RPC)

  frontend/
    package.json
    next.config.ts
    app/
      page.tsx                        # Root page — renders ChatUI
      layout.tsx                      # HTML layout, fonts, metadata
      globals.css                     # Tailwind import + CSS vars
      components/
        ChatUI.tsx                    # Main chat interface (SSE consumer)
      api/
        session/
          route.ts                    # POST /api/session — proxy to backend
        chat/
          route.ts                    # POST /api/chat — SSE proxy to backend
```

---

## 4. Database Setup (Supabase)

Create a Supabase project. Then run this SQL in the SQL Editor:

### `backend/tarini/db/schema.sql`

```sql
-- Tarini Agent — Supabase Schema
-- Apply via: Supabase Dashboard > SQL Editor > Run

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-user ready from day 1
  user_id TEXT,

  -- Legacy field from Agent SDK era — unused but kept for compatibility
  sdk_session_id TEXT,

  -- Onboarding stage: intro | structure | packages | mapping | verification
  stage TEXT NOT NULL DEFAULT 'intro',

  -- All property data as a flexible JSONB blob.
  state JSONB NOT NULL DEFAULT '{}',

  -- Monotonically increasing version — incremented on every update_state call
  state_version INTEGER NOT NULL DEFAULT 1,

  -- Conversation history for persistence across server restarts
  messages JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sdk_id ON sessions(sdk_session_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Atomic state update: replaces state JSONB and increments state_version in ONE statement.
-- Eliminates the read-modify-write race condition.
-- Called via: client.rpc("update_session_state_atomic", {...}).execute()
CREATE OR REPLACE FUNCTION update_session_state_atomic(
  p_session_id UUID,
  p_new_state   JSONB
)
RETURNS SETOF sessions
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE sessions
     SET state         = p_new_state,
         state_version = state_version + 1,
         updated_at    = NOW()
   WHERE id = p_session_id
   RETURNING *;
END;
$$;
```

**Important:** The `messages` column was added after the initial schema. If you're working from an older database, run:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]';
```

---

## 5. Backend — Python / FastAPI

### 5.1 Configuration Files

#### `backend/requirements.txt`

```
anthropic>=0.42.0
supabase==2.28.0
fastapi==0.115.14
uvicorn[standard]==0.29.0
python-dotenv==1.0.1
pydantic==2.12.5
```

#### `backend/runtime.txt`

```
python-3.12.0
```

#### `backend/render.yaml`

```yaml
services:
  - type: web
    name: tarini-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
    autoDeploy: true
```

#### Environment variables (set in Render dashboard)

| Var | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (not the anon key) |
| `PYTHON_VERSION` | `3.12.0` (must also be set as env var — Render ignores runtime.txt alone) |
| `DEPLOY_TRIGGER` | Any value; change it to force a redeploy (auto-deploy from git doesn't trigger reliably) |

---

### 5.2 Database Client

#### `backend/tarini/db/__init__.py`

```python
# (empty)
```

#### `backend/tarini/db/client.py`

```python
"""
Supabase client singleton + session helpers.

Uses the native async supabase-py client so it works correctly inside
FastAPI's async event loop without thread-pool wrappers.

The client is initialised once during app startup (via init_client / close_client)
and stored as a module-level variable — a simple, safe pattern for FastAPI apps.
"""
import os

from supabase import AsyncClient, acreate_client


# ---------------------------------------------------------------------------
# Module-level async client (set during lifespan startup)
# ---------------------------------------------------------------------------

_client: AsyncClient | None = None


async def init_client() -> None:
    """Call once during FastAPI lifespan startup."""
    global _client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    _client = await acreate_client(url, key)


async def close_client() -> None:
    """Call once during FastAPI lifespan shutdown."""
    global _client
    _client = None  # AsyncClient has no explicit close — GC handles cleanup


def _get_client() -> AsyncClient:
    if _client is None:
        raise RuntimeError("Supabase client not initialised — call init_client() first")
    return _client


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def create_session(user_id: str | None = None) -> dict:
    """Create a new session row. Returns the full session dict."""
    c = _get_client()
    row: dict = {}
    if user_id:
        row["user_id"] = user_id
    result = await c.table("sessions").insert(row).execute()
    return result.data[0]


async def get_session(session_id: str) -> dict | None:
    """Fetch a session by ID. Returns None if not found."""
    c = _get_client()
    result = await c.table("sessions").select("*").eq("id", session_id).execute()
    return result.data[0] if result.data else None


async def load_messages(session_id: str) -> list:
    """Load conversation history from the session's messages JSONB column."""
    c = _get_client()
    result = await (
        c.table("sessions")
        .select("messages")
        .eq("id", session_id)
        .execute()
    )
    if not result.data:
        return []
    return result.data[0].get("messages") or []


async def save_messages(session_id: str, messages: list) -> None:
    """Persist conversation history to the session's messages JSONB column."""
    c = _get_client()
    await (
        c.table("sessions")
        .update({"messages": messages})
        .eq("id", session_id)
        .execute()
    )


async def update_session_state(session_id: str, new_state: dict) -> dict:
    """Replace the session's state JSONB blob and increment state_version atomically.

    Uses the update_session_state_atomic Postgres RPC — no extra round-trip, no race.
    """
    c = _get_client()
    result = await c.rpc(
        "update_session_state_atomic",
        {"p_session_id": session_id, "p_new_state": new_state},
    ).execute()
    if not result.data:
        raise ValueError(f"Session {session_id} not found")
    return result.data[0]


async def advance_stage(session_id: str, stage: str) -> dict:
    """Update the stage field."""
    c = _get_client()
    result = await (
        c.table("sessions")
        .update({"stage": stage})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]
```

---

### 5.3 System Prompt

#### `backend/tarini/prompts/__init__.py`

```python
from pathlib import Path


def load_system_prompt() -> str:
    """Load Tarini's system prompt from the markdown file."""
    prompt_file = Path(__file__).parent / "system_prompt.md"
    return prompt_file.read_text(encoding="utf-8")


# Single source of truth for the silent opening prompt that triggers the greeting.
# Imported by both server.py (web) and main.py (CLI) — never duplicated.
INITIAL_PROMPT = (
    "Session started. Call get_state immediately to check current progress, "
    "then greet the user appropriately based on their stage and what has been saved."
)
```

#### `backend/tarini/prompts/system_prompt.md`

This is a 354-line markdown file that defines Tarini's character, language rules, tools, conversation rules, error recovery, onboarding stages, and more. It is too long to inline here but lives at the path above. Key sections:

- **Character:** Warm, patient, expert, honest, adaptive, not robotic
- **Language:** Mirror user's language (English/Hindi/Hinglish) automatically
- **Tools:** `get_state`, `update_state`, `advance_stage` (described with usage rules)
- **Conversation rules:** One question per turn, confirm before save, ambiguous = no mutation
- **Error recovery:** 3-tier escalation, never dead-end
- **Stages:** intro > structure > packages > mapping > verification
- **Never does:** Uses tech terms, claims false saves, bullet-point lists

---

### 5.4 Tool Definitions & Dispatcher

#### `backend/tarini/tools/__init__.py`

```python
"""
Tarini tool definitions for Anthropic API tool use.

TOOL_DEFINITIONS: list of dicts in Anthropic tool-use format.
execute_tool(session_id, tool_name, tool_input): dispatches to the right handler.
"""
from .state import get_state, update_state, advance_stage

TOOL_DEFINITIONS = [
    {
        "name": "get_state",
        "description": (
            "Get the current property onboarding state for this session. "
            "Call this at the start of every conversation — before saying anything — "
            "to know the stage and all property data collected so far. "
            "Never assume what is saved; always check."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "update_state",
        "description": (
            "Save confirmed property information. Call this after the user explicitly "
            "confirms a piece of information. The `updates` dict is deep-merged into the "
            "existing state — only pass the fields that actually changed. "
            "Never claim to have saved something without calling this tool first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "object",
                    "additionalProperties": True,
                    "description": (
                        "Key-value pairs to deep-merge into current state. "
                        "Use nested dicts for structured data."
                    ),
                }
            },
            "required": ["updates"],
        },
    },
    {
        "name": "advance_stage",
        "description": (
            "Mark the current onboarding stage as complete and record the next stage. "
            "Only call this when the user has confirmed all information for the current stage. "
            "Valid stages in order: intro > structure > packages > mapping > verification."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "enum": ["intro", "structure", "packages", "mapping", "verification"],
                    "description": "The stage to advance to.",
                }
            },
            "required": ["stage"],
        },
    },
]


async def execute_tool(session_id: str, tool_name: str, tool_input: dict) -> str:
    """Dispatch a tool call and return the result as a JSON string."""
    if tool_name == "get_state":
        return await get_state(session_id)
    elif tool_name == "update_state":
        return await update_state(session_id, tool_input.get("updates", {}))
    elif tool_name == "advance_stage":
        return await advance_stage(session_id, tool_input.get("stage", ""))
    else:
        return f'{{"error": "Unknown tool: {tool_name}"}}'
```

---

### 5.5 Tool Implementations (State)

#### `backend/tarini/tools/state.py`

```python
"""
Tarini's 3 state tools — pure async functions returning JSON strings.

These are called by the tool dispatcher in __init__.py.
"""
import json
from copy import deepcopy

from tarini.db import client as db


# ---------------------------------------------------------------------------
# Deep merge utility
# ---------------------------------------------------------------------------

def _deep_merge(base: dict, updates: dict) -> dict:
    """
    Recursively merge `updates` into `base`.
    - Dicts are merged recursively.
    - All other types are overwritten.
    - Lists are overwritten (not appended), allowing replacements.
    """
    result = deepcopy(base)
    for key, value in updates.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


VALID_STAGES = ("intro", "structure", "packages", "mapping", "verification")


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def get_state(session_id: str) -> str:
    """Return session state as JSON string."""
    session = await db.get_session(session_id)
    if not session:
        return json.dumps({"error": "Session not found"})
    return json.dumps(
        {
            "stage": session.get("stage", "intro"),
            "state": session.get("state") or {},
            "state_version": session.get("state_version", 1),
        },
        ensure_ascii=False,
    )


async def update_state(session_id: str, updates: dict) -> str:
    """Deep-merge updates into session state. Return result as JSON string."""
    if not updates:
        return json.dumps({"error": "No updates provided"})

    session = await db.get_session(session_id)
    if not session:
        return json.dumps({"error": "Session not found"})

    current_state = session.get("state") or {}
    new_state = _deep_merge(current_state, updates)
    updated = await db.update_session_state(session_id, new_state)

    return json.dumps(
        {
            "saved": True,
            "state_version": updated.get("state_version"),
            "state": updated.get("state") or new_state,
        },
        ensure_ascii=False,
    )


async def advance_stage(session_id: str, stage: str) -> str:
    """Advance the session to a new stage. Return result as JSON string."""
    stage = (stage or "").strip()
    if stage not in VALID_STAGES:
        return json.dumps(
            {
                "error": (
                    f"Invalid stage: '{stage}'. "
                    f"Must be one of: {', '.join(VALID_STAGES)}"
                )
            }
        )

    updated = await db.advance_stage(session_id, stage)
    return json.dumps({"stage": updated.get("stage"), "advanced": True})
```

**Key design note:** `_deep_merge` overwrites lists, not appends. When the agent modifies `floors`, `units`, or `packages`, it must send the complete array.

---

### 5.6 Agent (Streaming Tool-Use Loop)

#### `backend/tarini/agent.py`

```python
"""
Anthropic API agent — streams Claude responses with tool-use loop.

stream_chat(session_id, user_message, history) is the single entry point.
It yields SSE-ready dicts: {"type": "text", "text": "..."} and {"type": "done"}.
"""
import logging
import os
from typing import AsyncIterator

import anthropic

from tarini.prompts import load_system_prompt
from tarini.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOOL_ROUNDS = 10  # safety limit to prevent infinite tool loops


async def stream_chat(
    session_id: str,
    user_message: str,
    history: list[dict],
) -> AsyncIterator[dict]:
    """
    Send a message to Claude and stream the response, handling tool use.

    Args:
        session_id: Session UUID for tool dispatch.
        user_message: The user's message text.
        history: Mutable list of conversation messages (updated in-place).

    Yields:
        SSE event dicts: {"type": "text", "text": "..."} or {"type": "done"}.
    """
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = load_system_prompt()

    # Add the user message to history
    history.append({"role": "user", "content": user_message})

    for _round in range(MAX_TOOL_ROUNDS):
        logger.info(
            "[stream_chat] round %d for session %s (%d messages)",
            _round, session_id, len(history),
        )

        # Stream the API response
        collected_text = ""
        tool_use_blocks = []

        async with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=history,
            tools=TOOL_DEFINITIONS,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        text = event.delta.text
                        collected_text += text
                        yield {"type": "text", "text": text}

            # Get the final message to check for tool use
            final_message = await stream.get_final_message()

        # Record the assistant's full response in history (serialised to plain dicts
        # so the history is JSON-storable in Supabase)
        history.append({
            "role": "assistant",
            "content": _serialize_content(final_message.content),
        })

        # Check if the model wants to use tools
        tool_use_blocks = [
            block for block in final_message.content
            if block.type == "tool_use"
        ]

        if final_message.stop_reason != "tool_use" or not tool_use_blocks:
            # No tool use — we're done
            yield {"type": "done"}
            return

        # Execute all tool calls and build tool results
        tool_results = []
        for tool_block in tool_use_blocks:
            logger.info(
                "[stream_chat] executing tool %s for session %s",
                tool_block.name, session_id,
            )
            result_str = await execute_tool(
                session_id, tool_block.name, tool_block.input,
            )
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result_str,
            })

        # Add tool results to history and loop back for next response
        history.append({"role": "user", "content": tool_results})

    # Safety: if we hit the max rounds, end gracefully
    logger.warning("[stream_chat] hit MAX_TOOL_ROUNDS for session %s", session_id)
    yield {"type": "done"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_content(content) -> list[dict]:
    """Convert Anthropic SDK content blocks to plain JSON-serialisable dicts."""
    out: list[dict] = []
    for block in content:
        if block.type == "text":
            out.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            out.append({
                "type": "tool_use",
                "id": block.id,
                "name": block.name,
                "input": block.input,
            })
    return out
```

**Key design notes:**
- `history` is a **mutable list** passed by reference. Both `stream_chat` and the session manager share the same list object.
- `_serialize_content()` converts Anthropic SDK pydantic models (`TextBlock`, `ToolUseBlock`) to plain dicts so they can be stored in Supabase JSONB.
- The tool-use loop iterates up to `MAX_TOOL_ROUNDS` (10) to prevent infinite loops. Each iteration: call Claude > stream text > check if tool use > execute tools > add results to history > loop.

---

### 5.7 Session Manager

#### `backend/tarini/session_manager.py`

```python
"""
Per-session conversation history manager.

Manages in-memory message history for each session, backed by Supabase persistence.
On cache miss (e.g. after Render free-tier spin-down) the history is reloaded from
the database so conversations survive server restarts.

Guarantees:
  * One message history list per session (created lazily or loaded from DB).
  * One asyncio.Lock per session for query serialisation.
  * History is persisted to Supabase after every turn.
  * Idle sessions are evicted after _IDLE_TTL_SECONDS (default 30 min).
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from tarini.agent import stream_chat
from tarini.db import client as db

logger = logging.getLogger(__name__)

_IDLE_TTL_SECONDS = 30 * 60
_EVICTION_INTERVAL_SECONDS = 5 * 60


class SessionManager:
    def __init__(self) -> None:
        # session_id -> list of conversation messages
        self._histories: dict[str, list[dict]] = {}
        # Locks to serialise queries (one at a time per session)
        self._query_locks: dict[str, asyncio.Lock] = {}
        # Last-used timestamps for idle eviction
        self._last_used: dict[str, float] = {}
        # Background eviction task
        self._eviction_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start_eviction_task(self) -> None:
        self._eviction_task = asyncio.create_task(self._evict_idle_sessions())
        logger.info(
            "Session eviction task started (TTL=%ds, interval=%ds)",
            _IDLE_TTL_SECONDS, _EVICTION_INTERVAL_SECONDS,
        )

    @asynccontextmanager
    async def query_lock(self, session_id: str) -> AsyncIterator[None]:
        """Acquire the per-session lock for query serialisation."""
        lock = self._query_locks.setdefault(session_id, asyncio.Lock())
        async with lock:
            yield

    async def chat(
        self, session_id: str, user_message: str,
    ) -> AsyncIterator[dict]:
        """
        Send a message and stream SSE events. Manages history automatically.
        Must be called inside a query_lock context.

        On cache miss (server restarted / session evicted) the history is
        loaded from Supabase so the conversation picks up where it left off.
        After the turn completes the updated history is persisted back.
        """
        # Load from DB on cache miss
        if session_id not in self._histories:
            logger.info("Cache miss for session %s — loading history from DB", session_id)
            self._histories[session_id] = await db.load_messages(session_id)

        history = self._histories[session_id]
        self._last_used[session_id] = time.monotonic()

        async for event in stream_chat(session_id, user_message, history):
            # Persist BEFORE yielding "done" — the SSE generator cancels our
            # task immediately after receiving "done", so post-yield code
            # would never execute.
            if event.get("type") == "done":
                self._last_used[session_id] = time.monotonic()
                try:
                    await db.save_messages(session_id, history)
                    logger.info(
                        "Persisted %d messages for session %s",
                        len(history), session_id,
                    )
                except Exception:
                    logger.exception(
                        "Failed to persist messages for session %s", session_id,
                    )
            yield event

    def remove_session(self, session_id: str) -> None:
        """Remove all state for a session."""
        self._histories.pop(session_id, None)
        self._query_locks.pop(session_id, None)
        self._last_used.pop(session_id, None)
        logger.info("Removed session %s", session_id)

    async def cleanup(self) -> None:
        """Cancel eviction task and clear all sessions — called on shutdown."""
        if self._eviction_task is not None:
            self._eviction_task.cancel()
            try:
                await self._eviction_task
            except asyncio.CancelledError:
                pass
            self._eviction_task = None

        self._histories.clear()
        self._query_locks.clear()
        self._last_used.clear()

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    async def _evict_idle_sessions(self) -> None:
        while True:
            await asyncio.sleep(_EVICTION_INTERVAL_SECONDS)
            now = time.monotonic()
            idle = [
                sid for sid, last in list(self._last_used.items())
                if (now - last) >= _IDLE_TTL_SECONDS
            ]
            for session_id in idle:
                logger.info("Evicting idle session %s", session_id)
                self.remove_session(session_id)


# Module-level singleton
session_manager = SessionManager()
```

**Critical design note:** The `chat()` method persists history **before** yielding the `"done"` event. This is because the SSE generator in `server.py` cancels the `_run_chat` task immediately after receiving `"done"`. Any code after the yield would never execute due to task cancellation. This was a hard-won lesson (see memory.md).

---

### 5.8 FastAPI Server

#### `backend/server.py`

```python
"""
Tarini FastAPI server — SSE streaming chat API.

Uses direct Anthropic API calls (no CLI subprocess).

Endpoints:
  POST /sessions              -> create a new session
  GET  /sessions/{id}         -> get session state
  POST /sessions/{id}/chat    -> send a message, stream Tarini's response (SSE)

SSE event format:
  data: {"type": "text",  "text": "..."}
  data: {"type": "done"}
  data: {"type": "error", "message": "..."}
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

from tarini.db import client as db
from tarini.prompts import INITIAL_PROMPT
from tarini.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tarini server starting up")
    await db.init_client()
    session_manager.start_eviction_task()
    yield
    logger.info("Tarini server shutting down")
    await session_manager.cleanup()
    await db.close_client()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Tarini API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field("", max_length=8000)


# ---------------------------------------------------------------------------
# SSE keepalive helper
# ---------------------------------------------------------------------------

async def _stream_with_keepalives(
    session_id: str,
    user_message: str,
    keepalive_interval: float = 2.0,
):
    """
    Async generator that streams chat events with keepalives.

    Uses asyncio.Queue bridge so the chat logic runs in a background task
    while keepalives are sent during quiet periods (tool execution, API calls).
    """
    yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def _run_chat() -> None:
        try:
            async with session_manager.query_lock(session_id):
                async for event in session_manager.chat(session_id, user_message):
                    await queue.put(event)
        except Exception:
            logger.exception("[_run_chat] ERROR for session %s", session_id)
            session_manager.remove_session(session_id)
            await queue.put({"type": "error", "message": "An error occurred. Please try again."})
        finally:
            await queue.put(None)  # sentinel

    task = asyncio.create_task(_run_chat())

    # Drain queue with keepalives using asyncio.wait (not wait_for)
    get_task: asyncio.Task = asyncio.ensure_future(queue.get())
    try:
        while True:
            done, _ = await asyncio.wait({get_task}, timeout=keepalive_interval)

            if not done:
                yield f"data: {json.dumps({'type': 'thinking'})}\n\n"
                continue

            item = get_task.result()
            if item is None:
                break

            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

            if item.get("type") in ("done", "error"):
                break

            get_task = asyncio.ensure_future(queue.get())
    finally:
        if not get_task.done():
            get_task.cancel()
            try:
                await get_task
            except (asyncio.CancelledError, Exception):
                pass
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/sessions", status_code=201)
async def create_session():
    session = await db.create_session()
    return {"session_id": session["id"]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session["id"],
        "stage": session.get("stage"),
        "state": session.get("state") or {},
        "state_version": session.get("state_version"),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
    }


@app.post("/sessions/{session_id}/chat")
async def chat(session_id: str, body: ChatRequest):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = (body.message or "").strip() or INITIAL_PROMPT

    return StreamingResponse(
        _stream_with_keepalives(session_id, user_message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**SSE Architecture — Queue Bridge Pattern:**

```
                    asyncio.Queue
┌─────────────┐       ┌───┐       ┌──────────────────────────┐
│  _run_chat   │──put──│ Q │──get──│ _stream_with_keepalives  │──yield──> HTTP SSE
│  (bg task)   │       └───┘       │  (async generator)       │
└─────────────┘                    │  2s timeout → keepalive  │
                                   └──────────────────────────┘
```

1. `_stream_with_keepalives()` yields SSE events to the HTTP response
2. `_run_chat()` (background task) iterates `session_manager.chat()` and puts events into a Queue
3. The SSE generator drains the queue with `asyncio.wait()` timeout for 2-second keepalive pings
4. On `"done"` or `"error"` event, SSE generator breaks and cancels the `_run_chat` task in its `finally` block

---

## 6. Frontend — Next.js

### 6.1 Configuration Files

#### `frontend/package.json`

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

#### `frontend/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

#### Environment variables (set in Vercel dashboard)

| Var | Description |
|---|---|
| `BACKEND_URL` | Full URL of the Render backend (e.g., `https://tarini-backend-d79e.onrender.com`) |

---

### 6.2 API Routes (Proxy)

The frontend proxies requests to the backend. This avoids CORS issues and keeps the backend URL private.

#### `frontend/app/api/session/route.ts`

```typescript
// Edge Runtime: no 10-second function timeout — needed when Render cold-starts (30-90s).
export const runtime = "edge";

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST() {
  const res = await fetch(`${BACKEND_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 201 });
}
```

#### `frontend/app/api/chat/route.ts`

```typescript
// Edge Runtime: no function timeout — required for SSE streams that can last 30-60 seconds.
// fetch() and ReadableStream are natively supported in the Edge Runtime.
export const runtime = "edge";

import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const { session_id, message } = await request.json();

  const res = await fetch(`${BACKEND_URL}/sessions/${session_id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message ?? "" }),
  });

  if (!res.ok || !res.body) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Backend unavailable" })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  // Proxy the SSE stream straight through
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
```

**Why Edge Runtime?** Next.js serverless functions have a 10-second timeout by default. SSE streams can last 30-60 seconds (Claude thinking + tool execution). Edge Runtime has no function timeout.

---

### 6.3 Chat UI Component

#### `frontend/app/page.tsx`

```typescript
import ChatUI from "./components/ChatUI";

export default function Home() {
  return <ChatUI />;
}
```

#### `frontend/app/components/ChatUI.tsx`

This is a 377-line React component. Key behaviors:

- **Session init:** On mount, checks `localStorage` for `tarini_session_id`. Creates new session if missing.
- **Opening greeting:** Sends empty message (`sendMessage("")`) when session connects. Backend replaces with `INITIAL_PROMPT`.
- **SSE streaming:** `streamChat()` async generator reads the response body, parses `data:` lines, yields text chunks.
- **Abort handling:** `AbortController` per send, cancelled on unmount or new session.
- **Auto-scroll:** Scrolls to bottom on new messages.
- **Textarea auto-resize:** Grows up to 160px based on content.
- **New session:** Aborts in-flight stream, clears localStorage, creates fresh session.
- **UI:** Dark theme (zinc-950), amber accents, message bubbles with avatars, typing indicator (bouncing dots), streaming cursor.

The full source is in the file at `frontend/app/components/ChatUI.tsx`.

---

### 6.4 Layout & Styles

#### `frontend/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tarini — RentOK Property Onboarding",
  description: "AI-powered property onboarding specialist",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

#### `frontend/app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

---

## 7. Deployment

### 7.1 Backend on Render

1. Create a new **Web Service** on Render
2. Connect to your GitHub repo
3. Set:
   - **Root directory:** `backend`
   - **Runtime:** Python
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Health check path:** `/health`
4. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PYTHON_VERSION` = `3.12.0`
   - `DEPLOY_TRIGGER` = `1` (change this value to force redeployments)
5. Choose Singapore region (closest to Indian users)

**Render free tier notes:**
- 512MB RAM — works fine with direct Anthropic API (~80MB usage)
- Spins down after ~15 min idle. Cold start takes 20-30s.
- Auto-deploy from git push does NOT reliably trigger. Change `DEPLOY_TRIGGER` env var to force redeploy.
- Python version: Must be pinned via BOTH `runtime.txt` AND `PYTHON_VERSION` env var. Without both, Render may default to Python 3.14+ which causes `anyio` issues.

### 7.2 Frontend on Vercel

1. Connect GitHub repo to Vercel
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `BACKEND_URL` = `https://your-backend.onrender.com`
4. Deploy — Vercel auto-detects Next.js

**Why the API proxy?** The frontend Next.js API routes (`/api/session`, `/api/chat`) proxy to the backend. This:
- Avoids CORS issues
- Keeps the backend URL private (not exposed to the browser)
- Allows Edge Runtime for no function timeout (needed for long SSE streams)

---

## 8. Data Flow — End to End

### New Session Flow

```
1. Browser loads page
2. ChatUI useEffect → POST /api/session → Vercel Edge → POST backend/sessions → Supabase INSERT
3. Returns session_id → stored in localStorage
4. ChatUI useEffect(sessionId) → sendMessage("")
5. POST /api/chat {session_id, message: ""} → Vercel Edge → POST backend/sessions/{id}/chat
6. Backend: empty message → replaced with INITIAL_PROMPT
7. Backend: session_manager.chat()
   a. Cache miss → db.load_messages() → empty []
   b. Add user message to history
   c. stream_chat() round 0:
      - Claude calls get_state tool → reads session from Supabase
      - Gets {stage: "intro", state: {}} → fresh session
      - Claude responds with greeting text
   d. Text chunks → yield {type: "text"} events → SSE
   e. Done → save_messages() to Supabase → yield {type: "done"}
8. Browser: streamChat() yields text chunks → MessageBubble updates
```

### Returning Session Flow (after server restart)

```
1. Browser loads page → finds session_id in localStorage
2. sendMessage("") triggers opening
3. session_manager.chat() → cache miss → db.load_messages() → loaded from Supabase
4. history restored → Claude has full conversation context
5. Claude calls get_state → sees saved property data → resumes naturally
```

### Tool Use Flow

```
1. User says "I have a PG in Koramangala"
2. Claude: "Great, a PG in Koramangala! Can I save that?" → yields text
3. User says "Yes"
4. Claude calls update_state tool:
   a. stream_chat pauses text streaming
   b. Executes update_state(session_id, {property_type: "pg", property_location: "Koramangala"})
   c. _deep_merge into existing state
   d. Supabase RPC update_session_state_atomic
   e. Returns {saved: true, state_version: 2}
5. Claude sees tool result, generates confirmation text
6. stream_chat continues to next round → yields confirmation text → done
```

---

## 9. Key Gotchas & Lessons Learned

### 1. Task Cancellation Bug (Critical)

The SSE generator (`_stream_with_keepalives`) cancels the `_run_chat` task immediately after receiving a `"done"` event. Any code placed **after** `yield event` in the `session_manager.chat()` async generator will never execute.

**Wrong:**
```python
async for event in stream_chat(session_id, user_message, history):
    yield event
# This never runs — task is cancelled after yielding "done"
await db.save_messages(session_id, history)
```

**Right:**
```python
async for event in stream_chat(session_id, user_message, history):
    if event.get("type") == "done":
        await db.save_messages(session_id, history)  # Save BEFORE yield
    yield event
```

### 2. Anthropic SDK Content Serialization

Anthropic's streaming SDK returns pydantic models (`TextBlock`, `ToolUseBlock`), not plain dicts. These can't be stored directly in Supabase JSONB. Use `_serialize_content()` to convert them.

### 3. Deep Merge Replaces Arrays

`_deep_merge` overwrites lists entirely (doesn't append). When the agent modifies `floors`, `units`, or `packages`, it must send the **complete** array, not just the changed element. This is by design — it allows deletions.

### 4. Render Free Tier Python Version

Without **both** `runtime.txt` and `PYTHON_VERSION` env var, Render may default to Python 3.14.3, which causes `anyio` compatibility issues. Pin to `3.12.0` in both places.

### 5. Render Auto-Deploy

Git push auto-deploy doesn't reliably trigger on Render. Use the `DEPLOY_TRIGGER` env var trick: change its value via the Render dashboard or API to force a redeploy.

### 6. Edge Runtime for SSE

Next.js serverless functions timeout at 10 seconds. SSE streams can last 30-60s. Use `export const runtime = "edge"` in API routes to remove the timeout.

### 7. localStorage Session Persistence

The frontend stores `tarini_session_id` in `localStorage`. If a user clears their browser data, they lose their session reference (though the data still exists in Supabase). The "New session" button explicitly clears this.
