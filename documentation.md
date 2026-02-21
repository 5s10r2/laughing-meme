# Tarini Agent — Complete Developer Recreation Guide

> **Purpose:** This guide contains every file, every line of code, and every decision needed to recreate the Tarini Agent system from scratch. A junior AI developer with Python and TypeScript knowledge can follow this document and have a working system.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Build Order](#4-build-order)
5. [Database Layer](#5-database-layer)
6. [MCP Tools Layer](#6-mcp-tools-layer)
7. [System Prompt](#7-system-prompt)
8. [Agent Configuration](#8-agent-configuration)
9. [Session Manager](#9-session-manager)
10. [FastAPI Server](#10-fastapi-server)
11. [Frontend Setup](#11-frontend-setup)
12. [Frontend API Proxies](#12-frontend-api-proxies)
13. [Frontend Chat UI](#13-frontend-chat-ui)
14. [Running the System](#14-running-the-system)
15. [Testing Each Layer](#15-testing-each-layer)
16. [Troubleshooting](#16-troubleshooting)
17. [Appendix A: CLI Development Tool](#appendix-a-cli-development-tool)
18. [Appendix B: Deployment](#appendix-b-deployment)
19. [Appendix C: File Reference](#appendix-c-file-reference)

---

## 1. Introduction

### What Is Tarini?

Tarini is an AI property onboarding chatbot for RentOK. Indian rental property operators describe their property through natural conversation — in English, Hindi, or Hinglish — and Tarini collects structured data about the property's structure, rental packages, and unit-to-package mappings.

### What Makes This Different from a Simple Chatbot?

- **Persistent state** — Claude doesn't hallucinate what was saved. Every save goes through a tool call to Supabase, and every session starts with a state check.
- **Session resumption** — Users can close the browser and come back. The conversation picks up exactly where they left off.
- **Domain expertise** — The 353-line system prompt encodes deep knowledge of Indian rental property types (PGs, hostels, BHK flats, co-living).

### Core Principle

> The system prompt IS the product. The code is infrastructure to deliver it.

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 20+ | Frontend runtime |
| npm | 10+ | Package management |
| Supabase account | Free tier | PostgreSQL database |
| Anthropic API key | — | Claude model access |

---

## 2. Architecture Overview

```
Browser (Next.js Chat UI on Vercel)
     │  HTTP / SSE
     ▼
FastAPI server (Python on Railway/Render)
     │
     ├─ ClaudeSDKClient (persistent session, resumable)
     │   ├─ System Prompt: Tarini's expertise + conversation rules
     │   └─ 3 In-Process MCP Tools: get_state, update_state, advance_stage
     │
     └─ Supabase (session + state persistence via JSONB)
```

**Why two hosts?** The Claude Agent SDK's `ClaudeSDKClient` maintains a persistent subprocess — it can't run as a stateless serverless function. The backend needs to be always-on (Railway/Render). The frontend is stateless and deploys perfectly to Vercel.

**Why a proxy pattern?** The Next.js API routes (`/api/session`, `/api/chat`) forward requests to the Python backend. This gives same-origin requests (no CORS in production) and a natural place for authentication later.

---

## 3. Prerequisites & Setup

### 3.1 Create the Project Directory

```bash
mkdir tarini-agent
cd tarini-agent
```

### 3.2 Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Service Role Key** (Settings → API)
3. You'll apply the SQL schema in Section 5

### 3.3 Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add credits to your account (Sonnet costs ~$0.03 per conversation)

### 3.4 Set Up the Backend

```bash
mkdir -p backend/tarini/{prompts,tools,db}
touch backend/tarini/__init__.py
cd backend

python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Create `backend/requirements.txt`:

```
claude-agent-sdk>=0.1.39
supabase>=2.10.0
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
python-dotenv>=1.0.0
pydantic>=2.10.0
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...your-key
```

Create `backend/.gitignore`:

```
.env
__pycache__/
*.pyc
*.pyo
.tarini_session
venv/
.venv/
*.egg-info/
dist/
```

### 3.5 Set Up the Frontend

```bash
cd ..  # back to tarini-agent/
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir
cd frontend
```

Create `frontend/.env.local`:

```
BACKEND_URL=http://localhost:8000
```

---

## 4. Build Order

Follow this exact order. Each step depends on the ones before it.

| # | File | Depends On |
|---|------|-----------|
| 1 | `db/schema.sql` | Supabase project |
| 2 | `db/client.py` | Schema applied |
| 3 | `tools/state.py` | `db/client.py` |
| 4 | `tools/__init__.py` | `tools/state.py` |
| 5 | `prompts/system_prompt.md` | Nothing (standalone) |
| 6 | `prompts/__init__.py` | `system_prompt.md` |
| 7 | `agent.py` | Tools + prompts |
| 8 | `session_manager.py` | `agent.py` + `db/client.py` |
| 9 | `server.py` | Everything above |
| 10 | Test with curl | Server running |
| 11 | Frontend scaffold | Node.js |
| 12 | `api/session/route.ts` | Backend running |
| 13 | `api/chat/route.ts` | Backend running |
| 14 | `ChatUI.tsx` | API routes |
| 15 | End-to-end test | Everything |

---

## 5. Database Layer

### 5.1 Schema (`backend/tarini/db/schema.sql`)

Apply this in the Supabase Dashboard → SQL Editor → Run:

```sql
-- Tarini Agent — Supabase Schema V1
-- Apply this via: Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-user ready from day 1
  user_id TEXT,

  -- Claude SDK session ID — used to resume conversations via ClaudeAgentOptions(resume=...)
  sdk_session_id TEXT,

  -- Onboarding stage: intro | structure | packages | mapping | verification
  stage TEXT NOT NULL DEFAULT 'intro',

  -- All property data as a flexible JSONB blob.
  -- Schema is defined in the system prompt; normalized in V2 once data model stabilises.
  -- Expected top-level keys:
  --   property_name, property_type, user_name,
  --   floors (array), units (array), packages (array)
  state JSONB NOT NULL DEFAULT '{}',

  -- Monotonically increasing version — incremented on every update_state call
  state_version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
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
```

**Key design decisions:**
- **JSONB `state` column** — Lets us iterate on data structure through prompt changes alone, no migrations needed. The schema is defined in the system prompt, not in SQL.
- **`state_version`** — Monotonic counter incremented on every `update_state`. Useful for debugging ("7 saves happened") and future optimistic concurrency.
- **`sdk_session_id`** — Captured from the Claude SDK's `ResultMessage` after the first successful exchange. Used for `resume=` on server restart.
- **`updated_at` trigger** — Auto-updates on every row change so we always know when a session was last active.

### 5.2 Database Client (`backend/tarini/db/client.py`)

This is the data access layer. It wraps the synchronous `supabase-py` client with `asyncio.to_thread()` so it plays nicely with FastAPI's async handlers.

```python
"""
Supabase client singleton + session helpers.

Uses the synchronous supabase-py client wrapped with asyncio.to_thread() so it
plays nicely with FastAPI's async handlers without introducing extra dependencies.
"""
import asyncio
import json
import os
from copy import deepcopy
from functools import lru_cache

from supabase import Client, create_client


# ---------------------------------------------------------------------------
# Singleton sync client
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Sync helpers (run inside asyncio.to_thread)
# ---------------------------------------------------------------------------

def _sync_create_session(user_id: str | None = None) -> dict:
    client = _get_client()
    row: dict = {}
    if user_id:
        row["user_id"] = user_id
    result = client.table("sessions").insert(row).execute()
    return result.data[0]


def _sync_get_session(session_id: str) -> dict | None:
    client = _get_client()
    result = (
        client.table("sessions")
        .select("*")
        .eq("id", session_id)
        .execute()
    )
    return result.data[0] if result.data else None


def _sync_update_sdk_session_id(session_id: str, sdk_session_id: str) -> dict:
    client = _get_client()
    result = (
        client.table("sessions")
        .update({"sdk_session_id": sdk_session_id})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


def _sync_update_session_state(session_id: str, new_state: dict, new_version: int) -> dict:
    client = _get_client()
    result = (
        client.table("sessions")
        .update({"state": json.dumps(new_state), "state_version": new_version})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


def _sync_advance_stage(session_id: str, stage: str) -> dict:
    client = _get_client()
    result = (
        client.table("sessions")
        .update({"stage": stage})
        .eq("id", session_id)
        .execute()
    )
    return result.data[0]


# ---------------------------------------------------------------------------
# Async public API
# ---------------------------------------------------------------------------

async def create_session(user_id: str | None = None) -> dict:
    """Create a new session row. Returns the full session dict."""
    return await asyncio.to_thread(_sync_create_session, user_id)


async def get_session(session_id: str) -> dict | None:
    """Fetch a session by ID. Returns None if not found."""
    return await asyncio.to_thread(_sync_get_session, session_id)


async def update_sdk_session_id(session_id: str, sdk_session_id: str) -> dict:
    """Persist the Claude SDK session ID for future resumption."""
    return await asyncio.to_thread(_sync_update_sdk_session_id, session_id, sdk_session_id)


async def update_session_state(session_id: str, new_state: dict) -> dict:
    """
    Replace the session's state JSONB blob and increment state_version.
    The caller is responsible for the merge; this just persists.
    """
    # Get current version to increment
    session = await get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    new_version = (session.get("state_version") or 1) + 1
    return await asyncio.to_thread(
        _sync_update_session_state, session_id, new_state, new_version
    )


async def advance_stage(session_id: str, stage: str) -> dict:
    """Update the stage field."""
    return await asyncio.to_thread(_sync_advance_stage, session_id, stage)
```

**Pattern:** Private `_sync_*` functions do the actual Supabase calls synchronously. Public `async` functions wrap them with `asyncio.to_thread()`. The `@lru_cache(maxsize=1)` ensures only one Supabase client instance exists.

You also need `backend/tarini/db/__init__.py` (can be empty):

```python
# backend/tarini/db/__init__.py is empty
```

---

## 6. MCP Tools Layer

### 6.1 State Tools (`backend/tarini/tools/state.py`)

These are the 3 tools Claude uses to read and write session state. The key pattern is **closure binding** — `build_state_tools(session_id)` returns tool instances that have `session_id` captured in their closure, so Claude never needs to pass `session_id` as an argument.

```python
"""
Tarini's 3 MCP tools — each bound to a specific session_id via closure.

Tool pattern: build_state_tools(session_id) returns a list of SdkMcpTool instances
that are wired to the correct session without needing session_id as a call argument.
"""
import json
from copy import deepcopy
from typing import Any

from claude_agent_sdk import tool

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


# ---------------------------------------------------------------------------
# Tool factory
# ---------------------------------------------------------------------------

VALID_STAGES = ("intro", "structure", "packages", "mapping", "verification")


def build_state_tools(session_id: str) -> list:
    """
    Create tool instances bound to the given session_id.
    Called once per ClaudeSDKClient instantiation.
    """

    @tool(
        "get_state",
        (
            "Get the current property onboarding state for this session. "
            "Call this at the start of every conversation — before saying anything — "
            "to know the stage and all property data collected so far. "
            "Never assume what is saved; always check."
        ),
        {},
    )
    async def get_state(args: dict[str, Any]) -> dict[str, Any]:
        session = await db.get_session(session_id)
        if not session:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "Session not found"})}],
                "is_error": True,
            }
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "stage": session.get("stage", "intro"),
                            "state": session.get("state") or {},
                            "state_version": session.get("state_version", 1),
                        },
                        ensure_ascii=False,
                    ),
                }
            ]
        }

    @tool(
        "update_state",
        (
            "Save confirmed property information. Call this after the user explicitly "
            "confirms a piece of information. The `updates` dict is deep-merged into the "
            "existing state — only pass the fields that actually changed. "
            "Never claim to have saved something without calling this tool first."
        ),
        {
            "type": "object",
            "properties": {
                "updates": {
                    "type": "object",
                    "additionalProperties": True,
                    "description": (
                        "Key-value pairs to deep-merge into current state. "
                        "Use nested dicts for structured data. "
                        "Example: {\"floors\": [{\"index\": 0, \"label\": \"Ground Floor\"}], "
                        "\"packages\": [{\"id\": \"pkg_001\", \"name\": \"AC Double\", \"active\": true}]}"
                    ),
                }
            },
            "required": ["updates"],
        },
    )
    async def update_state(args: dict[str, Any]) -> dict[str, Any]:
        updates = args.get("updates", {})
        if not updates:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "No updates provided"})}],
                "is_error": True,
            }

        session = await db.get_session(session_id)
        if not session:
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "Session not found"})}],
                "is_error": True,
            }

        current_state = session.get("state") or {}
        new_state = _deep_merge(current_state, updates)
        updated = await db.update_session_state(session_id, new_state)

        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "saved": True,
                            "state_version": updated.get("state_version"),
                            "state": updated.get("state") or new_state,
                        },
                        ensure_ascii=False,
                    ),
                }
            ]
        }

    @tool(
        "advance_stage",
        (
            "Mark the current onboarding stage as complete and record the next stage. "
            "Only call this when the user has confirmed all information for the current stage. "
            "Valid stages in order: intro → structure → packages → mapping → verification."
        ),
        {"stage": str},
    )
    async def advance_stage(args: dict[str, Any]) -> dict[str, Any]:
        stage = args.get("stage", "").strip()
        if stage not in VALID_STAGES:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "error": (
                                    f"Invalid stage: '{stage}'. "
                                    f"Must be one of: {', '.join(VALID_STAGES)}"
                                )
                            }
                        ),
                    }
                ],
                "is_error": True,
            }

        updated = await db.advance_stage(session_id, stage)
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps({"stage": updated.get("stage"), "advanced": True}),
                }
            ]
        }

    return [get_state, update_state, advance_stage]
```

**Important patterns:**
- The `@tool` decorator takes 3 args: `(name, description, input_schema)`. The description is what Claude reads to decide when to call the tool.
- All tool functions receive `args: dict` and return MCP-compliant dicts with `content` array.
- `_deep_merge()` recursively merges nested dicts but overwrites lists (so you can replace a full floors array).
- `VALID_STAGES` tuple prevents Claude from setting an invalid stage.

### 6.2 MCP Server Factory (`backend/tarini/tools/__init__.py`)

This tiny file creates an in-process MCP server from the tool list:

```python
from claude_agent_sdk import create_sdk_mcp_server
from .state import build_state_tools


def build_mcp_server(session_id: str):
    """Create an in-process MCP server with state tools bound to session_id."""
    tools = build_state_tools(session_id)
    return create_sdk_mcp_server(
        name="tarini",
        version="1.0.0",
        tools=tools,
    )
```

The `name="tarini"` means tools are namespaced as `mcp__tarini__get_state`, `mcp__tarini__update_state`, `mcp__tarini__advance_stage`.

---

## 7. System Prompt

### Why the Prompt Matters Most

The system prompt is the single most important file in the project. It defines:
- Who Tarini is (character, expertise, tone)
- How she communicates (language rules, conversation rules)
- What she knows (Indian rental property types, floor structures, package patterns)
- When she saves data (tool usage rules, confirmation requirements)
- How she handles errors (3-strike protocol)
- The onboarding journey (4 stages with detailed guidance)

Every other file exists to let this prompt run reliably with persistent state.

### The File (`backend/tarini/prompts/system_prompt.md`)

This is a 353-line markdown file. Here are the key sections and WHY they exist:

**Character section (lines 1-19):** Defines warmth, patience, expertise, honesty, adaptiveness. Without this, Claude defaults to a generic assistant tone. We want Tarini to sound like the best human onboarding specialist — someone who never makes the operator feel slow.

**Language rules (lines 21-30):** Indian users code-switch between Hindi, English, and Hinglish constantly. Tarini must auto-mirror without asking "which language do you prefer?" This section also guards against a specific bug: Claude sometimes treats Hindi confusion phrases ("samajh nahi aaya") as a user's name.

**Tool documentation (lines 32-114):** Each tool has exact usage rules embedded in the prompt itself. The state schema is defined here (not in code) so Claude knows exactly what structure to use when calling `update_state`. This section includes the full JSONB schema with examples.

**Conversation rules (lines 116-141):** 11 non-negotiable rules. The most critical: "One question per turn" (prevents overwhelming operators), "Confirm before saving" (prevents bad data), "Never ask for something already confirmed" (prevents annoying repetition).

**Error recovery (lines 143-154):** A 3-strike protocol. First failure: retry silently. Second: acknowledge but continue. Third: give explicit choices. Most important rule: "Never pretend something was saved when it wasn't."

**Proactive quality checks (lines 156-165):** Like a sharp human specialist, Tarini catches things users don't think to mention: missing rents, unmapped rooms, dangling packages. These examples teach Claude the pattern of proactive observation.

**4 Stages (lines 168-294):** Detailed guidance for each onboarding stage. The structure stage encodes deep domain knowledge about PG rooms (private/double/triple/dorm), BHK flats, hostels, and naming patterns. The packages stage defines what a "package" is and its lifecycle. The mapping stage handles bulk assignment commands. The verification stage has completion blockers.

**Never list (lines 296-309):** Hard boundaries. Most critical: never use tech jargon ("Supabase", "JSON", "API"), never claim a save without calling the tool, never dump bullet-point lists.

**Session start (lines 311-333):** Different behavior for fresh vs. returning users. Fresh: warm greeting + first question. Returning: "Welcome back, we were working on [X]..." without re-introducing herself.

### The Prompt Loader (`backend/tarini/prompts/__init__.py`)

```python
from pathlib import Path


def load_system_prompt() -> str:
    """Load Tarini's system prompt from the markdown file."""
    prompt_file = Path(__file__).parent / "system_prompt.md"
    return prompt_file.read_text(encoding="utf-8")
```

Uses `Path(__file__).parent` so it works regardless of where the server is started from.

---

## 8. Agent Configuration

### `backend/tarini/agent.py`

This is the factory that creates a fully configured `ClaudeAgentOptions` object for each session:

```python
"""
ClaudeSDKClient options factory.

build_options(session_id, sdk_session_id) returns a ClaudeAgentOptions object
configured with:
  - claude-sonnet-4-20250514 model (direct Anthropic API)
  - Tarini's system prompt
  - In-process MCP tools bound to the session
  - bypassPermissions (tools run autonomously — no user permission dialogs)
  - resume= for session continuity across server restarts
"""
from claude_agent_sdk import ClaudeAgentOptions

from tarini.prompts import load_system_prompt
from tarini.tools import build_mcp_server


def build_options(
    session_id: str,
    sdk_session_id: str | None = None,
) -> ClaudeAgentOptions:
    """
    Create a fully configured ClaudeAgentOptions for a Tarini session.

    Uses direct Anthropic API. ANTHROPIC_API_KEY must be set in the environment.

    Args:
        session_id: Our Supabase session UUID (used to bind tools to correct session).
        sdk_session_id: Claude SDK session ID from a prior ResultMessage, for resumption.
    """
    return ClaudeAgentOptions(
        model="claude-sonnet-4-20250514",
        system_prompt=load_system_prompt(),
        allowed_tools=[
            "mcp__tarini__get_state",
            "mcp__tarini__update_state",
            "mcp__tarini__advance_stage",
        ],
        mcp_servers={"tarini": build_mcp_server(session_id)},
        permission_mode="bypassPermissions",
        resume=sdk_session_id,
    )
```

**Field-by-field explanation:**

| Field | Value | Why |
|-------|-------|-----|
| `model` | `"claude-sonnet-4-20250514"` | Best cost/quality ratio. ~40% cheaper than Opus with near-identical tool-use performance. |
| `system_prompt` | `load_system_prompt()` | Loaded fresh on each client creation (supports hot-reload during development). |
| `allowed_tools` | 3 tool names | Explicitly whitelists which MCP tools Claude can call. Uses `mcp__tarini__` prefix (server name + tool name). |
| `mcp_servers` | `{"tarini": build_mcp_server(session_id)}` | In-process MCP server with tools bound to this specific session. |
| `permission_mode` | `"bypassPermissions"` | Tools run autonomously — no interactive permission dialogs. Required for server-side use. |
| `resume` | `sdk_session_id` | If provided, restores the full conversation from a prior session. `None` for new sessions. |

---

## 9. Session Manager

### `backend/tarini/session_manager.py`

Manages the lifecycle of `ClaudeSDKClient` instances — one per active session. The dual-lock architecture prevents race conditions.

```python
"""
Per-session ClaudeSDKClient lifecycle management for the FastAPI server.

The manager keeps one ClaudeSDKClient alive per session_id.
On the first request for a session, it creates and connects the client.
On subsequent requests, it reuses the existing connected client.
If the server restarts, clients are reconstructed with resume=sdk_session_id.

Thread safety: asyncio.Lock per session prevents concurrent connect() calls
for the same session. A separate query-level lock serialises query()+receive_response()
pairs so they can't overlap within a session.
"""
import asyncio
import logging

from claude_agent_sdk import ClaudeSDKClient

from tarini.agent import build_options
from tarini.db import client as db

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self) -> None:
        # session_id → connected ClaudeSDKClient
        self._clients: dict[str, ClaudeSDKClient] = {}
        # Locks to prevent concurrent connect() for the same session
        self._connect_locks: dict[str, asyncio.Lock] = {}
        # Locks to serialise query+receive pairs (one at a time per session)
        self._query_locks: dict[str, asyncio.Lock] = {}

    def _connect_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._connect_locks:
            self._connect_locks[session_id] = asyncio.Lock()
        return self._connect_locks[session_id]

    def query_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._query_locks:
            self._query_locks[session_id] = asyncio.Lock()
        return self._query_locks[session_id]

    async def get_or_create_client(self, session_id: str) -> ClaudeSDKClient:
        """
        Return the active ClaudeSDKClient for this session, creating it if needed.
        Safe to call concurrently — the lock ensures only one connect() per session.
        """
        async with self._connect_lock(session_id):
            if session_id in self._clients:
                return self._clients[session_id]

            session = await db.get_session(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found in database")

            sdk_session_id = session.get("sdk_session_id") or None
            logger.info(
                "Creating ClaudeSDKClient for session %s (resume=%s)",
                session_id,
                sdk_session_id,
            )

            client = ClaudeSDKClient(
                options=build_options(
                    session_id=session_id,
                    sdk_session_id=sdk_session_id,
                )
            )
            await client.connect()
            self._clients[session_id] = client
            return client

    async def remove_client(self, session_id: str) -> None:
        """Disconnect and remove a client (e.g. on session error)."""
        client = self._clients.pop(session_id, None)
        if client:
            try:
                await client.disconnect()
            except Exception:
                pass

    async def cleanup(self) -> None:
        """Disconnect all clients — called on server shutdown."""
        for session_id, client in list(self._clients.items()):
            try:
                await client.disconnect()
                logger.info("Disconnected client for session %s", session_id)
            except Exception as exc:
                logger.warning("Error disconnecting session %s: %s", session_id, exc)
        self._clients.clear()


# Module-level singleton — imported by server.py
session_manager = SessionManager()
```

**Key concepts:**

- **Singleton pattern** — `session_manager = SessionManager()` at module level. Imported by `server.py`.
- **Connect lock** — Prevents two concurrent requests from creating two clients for the same session. Without this, a race condition could create duplicate `ClaudeSDKClient` instances.
- **Query lock** — Serializes `query()` + `receive_response()` pairs. The Claude SDK requires one complete exchange before starting another on the same client.
- **Error recovery** — `remove_client()` disconnects and removes a broken client so the next request creates a fresh one.
- **Graceful shutdown** — `cleanup()` is called by FastAPI's lifespan handler on server shutdown.

---

## 10. FastAPI Server

### `backend/server.py`

The main server file — 4 endpoints, SSE streaming, CORS, lifespan management:

```python
"""
Tarini FastAPI server — SSE streaming chat API.

Endpoints:
  POST /sessions              → create a new session
  GET  /sessions/{id}         → get session state
  POST /sessions/{id}/chat    → send a message, stream Tarini's response (SSE)

SSE event format:
  data: {"type": "text",  "text": "..."}
  data: {"type": "done"}
  data: {"type": "error", "message": "..."}
"""
import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from claude_agent_sdk import AssistantMessage, ResultMessage, TextBlock

from tarini.db import client as db
from tarini.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — clean up on shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tarini server starting up")
    yield
    logger.info("Tarini server shutting down — cleaning up sessions")
    await session_manager.cleanup()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Tarini API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/sessions", status_code=201)
async def create_session():
    """Create a new onboarding session. Returns the session_id for subsequent calls."""
    session = await db.create_session()
    return {"session_id": session["id"]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get current session state — useful for the frontend to restore UI."""
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
    """
    Send a message to Tarini and stream the response via SSE.

    If message is empty, Tarini is asked to check state and give an opening greeting.
    This is how the frontend triggers the initial greeting on new sessions.
    """
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Empty message → trigger opening greeting
    user_message = (body.message or "").strip()
    if not user_message:
        user_message = (
            "Session started. Call get_state immediately to check progress, "
            "then greet the user appropriately based on their stage and what has been saved."
        )

    async def generate():
        # Acquire the per-session query lock — prevents concurrent queries on same client
        async with session_manager.query_lock(session_id):
            try:
                # Re-fetch session inside the lock so sdk_session_id check is always current
                current_session = await db.get_session(session_id)
                if not current_session:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    return

                client = await session_manager.get_or_create_client(session_id)
                await client.query(user_message)

                captured_sdk_id: str | None = None

                async for msg in client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, TextBlock) and block.text:
                                yield f"data: {json.dumps({'type': 'text', 'text': block.text}, ensure_ascii=False)}\n\n"
                    elif isinstance(msg, ResultMessage):
                        captured_sdk_id = msg.session_id

                # Persist sdk_session_id on first successful exchange
                if captured_sdk_id and not session.get("sdk_session_id"):
                    await db.update_sdk_session_id(session_id, captured_sdk_id)
                    logger.info(
                        "Saved sdk_session_id %s for session %s",
                        captured_sdk_id,
                        session_id,
                    )

                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as exc:
                logger.exception("Error in chat stream for session %s", session_id)
                # Remove the broken client so next request creates a fresh one
                await session_manager.remove_client(session_id)
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for SSE
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Key patterns:**

- **Empty-message greeting trick** — When the frontend sends `{"message": ""}`, the server replaces it with a prompt that tells Claude to call `get_state` and greet the user. This triggers the opening greeting without the user having to say anything.
- **SSE format** — Each event is `data: {JSON}\n\n`. Three event types: `text` (streaming content), `done` (stream complete), `error` (something broke).
- **SDK session ID capture** — On the first successful exchange, the `ResultMessage` contains the SDK's internal session ID. We persist this to Supabase so future requests can use `resume=`.
- **Error recovery** — On exception, the broken client is removed via `session_manager.remove_client()`. The next request will create a fresh one.
- **`X-Accel-Buffering: no`** — Tells nginx (if present) not to buffer SSE responses.
- **`load_dotenv()` before imports** — Must run before the `tarini.db` import since `db/client.py` reads `SUPABASE_URL` from environment.

---

## 11. Frontend Setup

### 11.1 Project Scaffold

If you used `create-next-app` in Section 3.5, you already have the scaffolding. Here are the key configuration files:

### `frontend/package.json`

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

### `frontend/postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### `frontend/next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

### `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts", "**/*.ts", "**/*.tsx",
    ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

### `frontend/app/globals.css`

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

### `frontend/app/layout.tsx`

```tsx
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

### `frontend/app/page.tsx`

```tsx
import ChatUI from "./components/ChatUI";

export default function Home() {
  return <ChatUI />;
}
```

---

## 12. Frontend API Proxies

### 12.1 Session Creation (`frontend/app/api/session/route.ts`)

Creates a new session by forwarding to the backend:

```ts
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

### 12.2 Chat SSE Proxy (`frontend/app/api/chat/route.ts`)

Proxies the SSE stream from the backend — the key trick is passing `res.body` (a `ReadableStream`) directly as the response body:

```ts
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

**Why proxy?** Same-origin requests (no CORS), natural auth injection point, clean separation between frontend and backend URLs.

---

## 13. Frontend Chat UI

### `frontend/app/components/ChatUI.tsx`

The entire chat interface — 323 lines covering session management, SSE streaming, message state, and rendering:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "tarini";
  text: string;
  streaming?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function createSession(): Promise<string> {
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const { session_id } = await res.json();
  return session_id;
}

async function* streamChat(
  session_id: string,
  message: string
): AsyncGenerator<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, message }),
  });

  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      try {
        const event = JSON.parse(raw);
        if (event.type === "text" && event.text) {
          yield event.text;
        }
      } catch {
        // malformed SSE line — skip
      }
    }
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Session init ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      let sid = localStorage.getItem("tarini_session_id");

      if (!sid) {
        try {
          sid = await createSession();
          localStorage.setItem("tarini_session_id", sid);
        } catch {
          setMessages([
            {
              id: uid(),
              role: "tarini",
              text: "Sorry, I couldn't connect right now. Please check the backend is running and refresh.",
            },
          ]);
          return;
        }
      }

      setSessionId(sid);
    }
    init();
  }, []);

  // ── Trigger opening greeting once session is ready ────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    sendMessage(""); // empty string triggers the opening greeting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!sessionId || isStreaming) return;

    setIsStreaming(true);

    // Add user message (skip for the silent opening prompt)
    if (text.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: text.trim() },
      ]);
    }

    // Add a streaming Tarini message
    const streamId = uid();
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "tarini", text: "", streaming: true },
    ]);

    try {
      for await (const chunk of streamChat(sessionId, text)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId ? { ...m, text: m.text + chunk } : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId
            ? {
                ...m,
                text: "Sorry, something went wrong. Please try again.",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId ? { ...m, streaming: false } : m
        )
      );
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function handleNewSession() {
    if (isStreaming) return;
    localStorage.removeItem("tarini_session_id");
    setMessages([]);
    setSessionId(null);
    setInput("");
    // Re-init
    createSession().then((sid) => {
      localStorage.setItem("tarini_session_id", sid);
      setSessionId(sid);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100 leading-tight">Tarini</h1>
            <p className="text-xs text-zinc-500">RentOK Property Onboarding</p>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          disabled={isStreaming}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          New session
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Connecting to Tarini…</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-800 px-4 py-4"
      >
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || !sessionId}
            placeholder={isStreaming ? "Tarini is responding…" : "Type your message…"}
            rows={1}
            className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors disabled:opacity-40 max-h-40 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || !sessionId}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:opacity-50 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-zinc-950"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-2">
          Shift+Enter for new line · Enter to send
        </p>
      </form>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isTarini = message.role === "tarini";

  return (
    <div
      className={`flex gap-3 max-w-3xl mx-auto ${isTarini ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      {isTarini ? (
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-xs flex-shrink-0 mt-0.5">
          T
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0 mt-0.5">
          You
        </div>
      )}

      {/* Bubble */}
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
          isTarini
            ? "bg-zinc-900 text-zinc-100 rounded-tl-sm"
            : "bg-amber-500 text-zinc-950 rounded-tr-sm"
        }`}
      >
        {message.text ? (
          <span className="whitespace-pre-wrap">{message.text}</span>
        ) : (
          <span className="inline-flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
        {message.streaming && message.text && (
          <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
```

**Section-by-section walkthrough:**

1. **Types** — `Message` interface: `id` (unique string), `role` (user/tarini), `text` (content), `streaming?` (boolean for showing cursor).

2. **`createSession()`** — Calls `/api/session` (our Next.js proxy). Returns the Supabase UUID.

3. **`streamChat()`** — An async generator that:
   - POSTs to `/api/chat` with session_id + message
   - Reads the SSE stream chunk by chunk via `ReadableStream`
   - Parses `data: {JSON}` lines from the buffer
   - Yields text content for each `type: "text"` event

4. **Session init effect** — On mount, checks `localStorage.tarini_session_id`. Creates new session if missing. Stores session ID in state.

5. **Opening greeting effect** — When `sessionId` is set, calls `sendMessage("")` which triggers the backend's greeting logic.

6. **`sendMessage()`** — Core function:
   - Sets `isStreaming = true`
   - Adds user bubble (unless empty/silent greeting)
   - Adds empty Tarini bubble with `streaming: true`
   - Iterates over `streamChat()` generator, appending each chunk to the Tarini bubble
   - On error: replaces Tarini bubble text with error message
   - Finally: marks `streaming: false`, re-enables input

7. **Keyboard handling** — Enter submits. Shift+Enter inserts newline.

8. **New session** — Clears `localStorage`, resets state, creates fresh session.

9. **MessageBubble** — Tarini messages (left, dark background, amber avatar "T") vs user messages (right, amber background). Empty text shows bouncing dots animation. `streaming: true` with text shows a pulsing cursor.

---

## 14. Running the System

### Two-Terminal Setup

```bash
# Terminal 1: Backend
cd tarini-agent/backend
source venv/bin/activate
uvicorn server:app --reload --port 8000
```

```bash
# Terminal 2: Frontend
cd tarini-agent/frontend
npm run dev
```

### What to Expect

1. Open `http://localhost:3000` in your browser
2. You'll see "Connecting to Tarini…" briefly
3. After 10-50 seconds (cold start), Tarini's greeting appears
4. Type a message and hit Enter — Tarini responds with streaming text

**First request is slow** — The Claude Agent SDK starts a CLI subprocess, boots the MCP server, makes an API call with the 353-line system prompt, executes `get_state`, and generates a response. Subsequent messages are much faster (~3-8 seconds).

---

## 15. Testing Each Layer

### 15.1 Database Test

In Supabase Dashboard → SQL Editor:

```sql
-- Create a test session
INSERT INTO sessions DEFAULT VALUES RETURNING id;

-- Check it exists
SELECT * FROM sessions;

-- Clean up
DELETE FROM sessions WHERE state = '{}';
```

### 15.2 Backend API Tests (curl)

```bash
# Create a session
curl -X POST http://localhost:8000/sessions
# → {"session_id": "uuid-here"}

# Get session state
curl http://localhost:8000/sessions/<uuid>
# → {"id": "...", "stage": "intro", "state": {}, ...}

# Chat (SSE stream) — watch streaming events
curl -N http://localhost:8000/sessions/<uuid>/chat \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'
# → data: {"type": "text", "text": "Hi! I'm Tarini..."}
# → data: {"type": "done"}

# Health check
curl http://localhost:8000/health
# → {"status": "ok"}
```

### 15.3 Frontend SSE Test

Open Chrome DevTools → Network tab → filter by "Fetch/XHR":
- Look for the `/api/chat` request
- Check the "EventStream" tab to see individual SSE events
- Verify `type: "text"` events contain Tarini's streaming response

---

## 16. Troubleshooting

### CORS Errors

If you see CORS errors in the browser console, make sure:
- The backend's `allow_origins` includes your frontend URL (or `["*"]` for development)
- You're using the Next.js API proxy routes (not calling the backend directly from the browser)

### Missing API Key

```
Error: ANTHROPIC_API_KEY not set
```
→ Check `backend/.env` exists and has the correct key. Make sure `load_dotenv()` runs before any imports that need the key.

### SSE Stream Closes Immediately

This usually means the backend crashed during response generation. Check the backend terminal for Python tracebacks. Common causes:
- Missing environment variables
- Supabase connection issues (wrong URL or key)
- Claude SDK authentication failure

### Import Errors (`ModuleNotFoundError`)

```
ModuleNotFoundError: No module named 'claude_agent_sdk'
```
→ Make sure you're in the virtual environment (`source venv/bin/activate`) and have installed requirements (`pip install -r requirements.txt`).

### Frontend Shows "Connecting to Tarini…" Forever

1. Check the backend is running (`curl http://localhost:8000/health`)
2. Check `.env.local` has `BACKEND_URL=http://localhost:8000`
3. Open browser DevTools → Console for error messages
4. Try clearing localStorage: `localStorage.removeItem("tarini_session_id")`

### Slow First Response (30-60 Seconds)

Normal for the first message. The Claude Agent SDK boots a CLI subprocess, initializes the MCP server, sends the 353-line prompt to Claude, Claude calls `get_state`, then generates the greeting. Subsequent messages are 3-8 seconds.

### Session Not Resuming

Check that `sdk_session_id` is being persisted. In Supabase Dashboard:
```sql
SELECT id, sdk_session_id FROM sessions ORDER BY created_at DESC LIMIT 5;
```
If `sdk_session_id` is NULL after the first exchange, there may be an error in the `captured_sdk_id` logic in `server.py`.

---

## Appendix A: CLI Development Tool

### `backend/main.py`

A terminal-based chat interface for rapid system prompt iteration — no frontend needed:

```python
"""
Tarini CLI — development entry point for rapid testing and system prompt iteration.

Usage:
  cd backend
  python main.py

On first run: creates a new Supabase session and saves the session ID to .tarini_session.
On subsequent runs: loads the session ID and resumes the conversation.

To start fresh: delete the .tarini_session file.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from claude_agent_sdk import AssistantMessage, ClaudeSDKClient, ResultMessage, TextBlock

from tarini.agent import build_options
from tarini.db import client as db

SESSION_FILE = Path(".tarini_session")
INITIAL_PROMPT = (
    "Session started. Call get_state immediately to check current progress, "
    "then greet the user appropriately based on their stage and what has been saved."
)


async def load_or_create_session() -> dict:
    """Load session from file, or create a new one and save the ID."""
    if SESSION_FILE.exists():
        session_id = SESSION_FILE.read_text().strip()
        session = await db.get_session(session_id)
        if session:
            print(f"[Resuming session: {session_id[:8]}...]")
            return session
        else:
            print("[Session not found in database — starting fresh]")

    session = await db.create_session()
    SESSION_FILE.write_text(session["id"])
    print(f"[New session: {session['id'][:8]}...]")
    return session


def print_tarini(text: str) -> None:
    """Print Tarini's response with a label."""
    print(f"\nTarini: {text}", end="", flush=True)


async def run_turn(
    client: ClaudeSDKClient,
    message: str,
    session: dict,
) -> str | None:
    """
    Send a message, stream the response, and return the SDK session_id
    from the ResultMessage (if received for the first time).
    """
    await client.query(message)
    captured_sdk_id: str | None = None
    printed = False

    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock) and block.text:
                    if not printed:
                        print()  # newline before first chunk
                        printed = True
                    print_tarini(block.text)
        elif isinstance(msg, ResultMessage):
            captured_sdk_id = msg.session_id

    if printed:
        print()  # trailing newline

    return captured_sdk_id


async def main() -> None:
    session = await load_or_create_session()
    session_id = session["id"]
    sdk_session_id = session.get("sdk_session_id") or None

    options = build_options(session_id=session_id, sdk_session_id=sdk_session_id)

    print("\n" + "=" * 60)
    print("  Tarini — RentOK Property Onboarding")
    print("  Type 'exit' or 'quit' to end. 'new' to start over.")
    print("=" * 60)

    async with ClaudeSDKClient(options=options) as client:
        # Opening — Tarini checks state and greets
        sdk_id = await run_turn(client, INITIAL_PROMPT, session)
        if sdk_id and not sdk_session_id:
            await db.update_sdk_session_id(session_id, sdk_id)
            sdk_session_id = sdk_id

        # Chat loop
        while True:
            try:
                user_input = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nGoodbye!")
                break

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "bye"):
                print("\nTarini: Your progress is saved. See you next time!")
                break

            if user_input.lower() == "new":
                confirm = input("Start over? This will clear all saved data. (yes/no): ").strip()
                if confirm.lower() == "yes":
                    SESSION_FILE.unlink(missing_ok=True)
                    print("Starting fresh. Please restart the CLI.")
                    break
                else:
                    print("Okay, continuing where we left off.")
                    continue

            await run_turn(client, user_input, session)


if __name__ == "__main__":
    asyncio.run(main())
```

**Usage:**

```bash
cd backend
source venv/bin/activate
python main.py
```

Session state is saved to `.tarini_session` (gitignored). Delete this file to start fresh.

---

## Appendix B: Deployment

### Backend → Railway

```bash
cd backend
```

Create `Procfile`:
```
web: uvicorn server:app --host 0.0.0.0 --port $PORT
```

Deploy:
```bash
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Frontend → Vercel

```bash
cd frontend
vercel deploy
```

Set environment variable in Vercel dashboard:
- `BACKEND_URL` → your Railway URL (e.g., `https://tarini-backend.up.railway.app`)

**Important:** Tighten CORS in production. Change `allow_origins=["*"]` to `allow_origins=["https://your-vercel-url.vercel.app"]`.

---

## Appendix C: File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `backend/server.py` | 172 | FastAPI app — 4 endpoints, SSE streaming |
| `backend/main.py` | 136 | CLI entry point for development |
| `backend/requirements.txt` | 6 | Python dependencies |
| `backend/Procfile` | 1 | Railway deployment command |
| `backend/.env` | 3 | Environment variables (gitignored) |
| `backend/.gitignore` | 9 | Git ignore rules |
| `backend/tarini/__init__.py` | 0 | Package marker |
| `backend/tarini/agent.py` | 43 | ClaudeAgentOptions factory |
| `backend/tarini/session_manager.py` | 95 | Per-session client lifecycle + dual locks |
| `backend/tarini/prompts/__init__.py` | 8 | System prompt loader |
| `backend/tarini/prompts/system_prompt.md` | 353 | Tarini's character + expertise + rules |
| `backend/tarini/tools/__init__.py` | 13 | MCP server factory |
| `backend/tarini/tools/state.py` | 186 | 3 MCP tools + deep merge |
| `backend/tarini/db/__init__.py` | 0 | Package marker |
| `backend/tarini/db/schema.sql` | 48 | Supabase table + indexes + trigger |
| `backend/tarini/db/client.py` | 121 | Supabase client + async wrappers |
| `frontend/package.json` | 27 | Next.js project config |
| `frontend/next.config.ts` | 8 | Next.js configuration |
| `frontend/tsconfig.json` | 35 | TypeScript configuration |
| `frontend/postcss.config.mjs` | 8 | Tailwind 4 PostCSS config |
| `frontend/.env.local` | 1 | Backend URL |
| `frontend/app/layout.tsx` | 35 | Root layout — fonts, metadata |
| `frontend/app/page.tsx` | 5 | Root page — renders ChatUI |
| `frontend/app/globals.css` | 27 | Tailwind 4 + theme variables |
| `frontend/app/components/ChatUI.tsx` | 323 | Full chat interface + SSE streaming |
| `frontend/app/api/session/route.ts` | 21 | Session creation proxy |
| `frontend/app/api/chat/route.ts` | 35 | SSE stream proxy |
| **Total** | **~1,210** | |
