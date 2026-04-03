# Architecture

**Analysis Date:** 2026-04-03

## Pattern Overview

**Overall:** SSE-driven AI agent with generative UI components

**Key Characteristics:**
- Backend streams Claude API responses directly to frontend via Server-Sent Events (SSE)
- Frontend parses SSE events and renders components dynamically based on agent instructions
- Session state (onboarding progress, property data) persists in Supabase with fallback to in-memory store
- Tool-use loop: Claude calls backend tools (get_state, update_state, advance_stage, emit_ui) during inference
- Generative UI: Claude emits React component names + props inline during streaming; frontend renders them from a registry

## Layers

**Frontend (Next.js 16 + React 19):**
- Purpose: Interactive chat UI and dynamic component rendering for property onboarding
- Location: `frontend/app/`
- Contains: Page layout, chat interface, stage-specific components, API routes (edge runtime), context providers
- Depends on: Server backend for session/chat endpoints; Anthropic API (indirect via backend)
- Used by: Browser clients

**Backend (FastAPI + Anthropic SDK):**
- Purpose: Session management, agent orchestration, tool execution, SSE response streaming
- Location: `backend/`
- Contains: HTTP server, agent loop, tool implementations, database abstraction
- Depends on: Supabase (optional), Anthropic API for Claude inference
- Used by: Frontend API routes

**Database Layer:**
- Purpose: Persist session state, conversation messages, property data across server restarts
- Location: `backend/tarini/db/client.py`
- Contains: Async Supabase client wrapper + in-memory fallback
- Depends on: Supabase SDK or local dict store
- Used by: SessionManager, tool handlers

## Data Flow

**Session Creation:**

1. Frontend calls `POST /api/session` (Next.js edge route)
2. Edge route proxies to `POST /sessions` (FastAPI backend)
3. Backend calls `db.create_session()` → Supabase inserts row (or in-memory if offline)
4. SessionID returned to frontend, stored in localStorage

**Streaming Chat Turn:**

1. User sends message → frontend calls `POST /api/chat` with session_id + message
2. Edge route proxies to `POST /sessions/{id}/chat` (FastAPI)
3. SessionManager acquires query lock, loads message history from DB (or in-memory)
4. Calls `agent.stream_chat()` passing user_message + history
5. Agent streams Claude response:
   - Text chunks → `{"type": "text", "text": "..."}` events
   - Tool calls detected → yields `{"type": "tool_start", ...}` + execute + yield `{"type": "tool_complete", ...}`
   - Special emit_ui tool → yields `{"type": "component", "name": "...", "props": {...}}` directly (no tool indicator)
   - After update_state → yield `{"type": "state_snapshot", "state": {...}, "stage": "...", "stateVersion": ...}`
   - End of response → `{"type": "done"}`
6. SSE keepalive mechanism sends `{"type": "thinking"}` every 2 seconds during quiet periods
7. Frontend parser accumulates events, processes them via ChatUI event handler
8. SessionManager persists updated history to DB before yielding "done"

**State Management:**

1. Agent calls `update_state(updates)` tool → deep-merged into session.state in DB
2. Tool returns saved state + new version number
3. Agent yields state_snapshot SSE event with full state
4. Frontend OnboardingStateContext updates via `updateFromSnapshot()`
5. Components can read state from context for stage-specific rendering

## Key Abstractions

**SSEEvent (Frontend):**
- Purpose: Type-safe representation of backend streaming events
- Examples: `SSETextEvent`, `SSEComponentEvent`, `SSEToolStartEvent`, `SSEStateSnapshotEvent`
- Location: `frontend/app/lib/types.ts`
- Pattern: Discriminated union with `type` field for pattern matching

**Message + MessagePart (Frontend):**
- Purpose: Store accumulated SSE events for display
- Examples: `TextPart`, `ComponentPart`, `ToolActivityPart`
- Location: `frontend/app/lib/types.ts`
- Pattern: Mutable array of parts that grow as SSE events stream in

**SessionManager (Backend):**
- Purpose: Per-session state container with locking, cache management, idle eviction
- Location: `backend/tarini/session_manager.py`
- Pattern: Singleton managing dict of session_id → history list; asyncio.Lock per session for serialization

**Tool Dispatcher (Backend):**
- Purpose: Single async function dispatching to handler based on tool_name
- Location: `backend/tarini/tools/__init__.py`
- Pattern: `execute_tool(session_id, tool_name, tool_input)` → JSON string result

**Component Registry (Frontend):**
- Purpose: Central mapping of component name → React component class
- Location: `frontend/app/lib/component-registry.tsx`
- Pattern: Record of component names; `renderRegisteredComponent()` looks up by name and returns JSX

## Entry Points

**Frontend:**
- `frontend/app/page.tsx`: Root page → renders ChatUI component
- `frontend/app/layout.tsx`: Root layout with OnboardingStateProvider context wrapper
- `frontend/app/api/session/route.ts`: Edge runtime route for POST /api/session
- `frontend/app/api/chat/route.ts`: Edge runtime route for POST /api/chat (SSE proxy)

**Backend:**
- `backend/server.py`: FastAPI app definition + 3 routes: POST /sessions, GET /sessions/{id}, POST /sessions/{id}/chat
- `backend/main.py`: CLI entry point for local testing (uses AssistantMessage flow)

**Agent Loop:**
- `backend/tarini/agent.py`: `stream_chat(session_id, user_message, history)` is the single entry point for inference

## Error Handling

**Strategy:**
- Backend catches exceptions in SSE generator; yields error event + removes session
- Frontend catches fetch/abort errors; appends error text to current message
- Tool execution failures return JSON error object; agent sees it in tool_result and can decide to retry or report to user

**Patterns:**
- Async try/except in SessionManager.chat() + finally block persists history before "done"
- Tool result validation in agent.py (_tool_description, validate_emit_ui)
- HTTP 404 for missing sessions; 500 for backend unavailable

## Cross-Cutting Concerns

**Logging:**
- Backend uses Python logging module; log at INFO level for API calls, WARNING for fallbacks, DEBUG for token tracking
- Frontend uses console.warn for unregistered components

**Validation:**
- Tool input validated in backend via Pydantic (ChatRequest model)
- Component name + props validated in validate_emit_ui() before execution
- Frontend SSE parser ignores malformed lines (continue on JSON parse error)

**Authentication:**
- Not currently implemented; sessions are stateless UUIDs (anyone with a session ID can query it)
- CORS enabled on backend with allow_origins=["*"]
- Future: Add user_id field to session for per-user isolation

**State Persistence:**
- AsyncIO wrapper around Supabase async client
- In-memory fallback if SUPABASE_URL / SUPABASE_SERVICE_KEY not set
- Message history stored as JSON array; state stored as JSONB
- Atomic state update via Supabase RPC: read → merge → write (versioning)

---

*Architecture analysis: 2026-04-03*
