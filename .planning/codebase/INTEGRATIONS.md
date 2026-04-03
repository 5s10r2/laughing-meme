# External Integrations

**Analysis Date:** 2026-04-03

## APIs & External Services

**AI/LLM:**
- Anthropic Claude API - Core conversational AI agent
  - SDK: `anthropic >= 0.42.0` (`backend/tarini/agent.py`)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Model: `claude-sonnet-4-20250514` (`backend/tarini/agent.py` line 26)
  - Usage: Streaming chat responses with tool-use loop for property onboarding
  - Integration: Direct API calls via `anthropic.Anthropic()` client

## Data Storage

**Databases:**
- Supabase PostgreSQL - Session storage and conversation history
  - Connection: `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables
  - Client: `supabase` Python SDK v2.28.0 (`backend/tarini/db/client.py`)
  - Tables: `sessions` table with fields: `id`, `user_id`, `stage`, `state`, `state_version`, `messages`, `created_at`, `updated_at`
  - Fallback: In-memory store when Supabase unreachable (local development) — `_mem_sessions` dict (`backend/tarini/db/client.py` line 19-20)
  - Initialization: Async client created on app startup, connectivity check performed (`backend/tarini/db/client.py` lines 41-52)

**File Storage:**
- Not configured - Session data only (no file uploads)

**Caching:**
- In-memory session history cache - Per-session message history stored in memory with Supabase persistence backup (`backend/tarini/session_manager.py`)
- Idle session eviction - Sessions evicted after 30 minutes of inactivity (`backend/tarini/session_manager.py` line 25)

## Authentication & Identity

**Auth Provider:**
- Custom session-based (no external auth)
  - Implementation: Session IDs generated as UUIDs (`backend/tarini/db/client.py` line 72)
  - Frontend creates session via POST `/api/session` → proxies to `/sessions` backend endpoint
  - Session returned: `{"session_id": "..."}`
  - Stateless for client - All state managed server-side in Supabase

## Monitoring & Observability

**Error Tracking:**
- Not configured (no Sentry/Rollbar detected)

**Logs:**
- Python logging module - INFO level logs for session management, Supabase connectivity
  - Logger setup: `logging.basicConfig(level=logging.INFO)` in `backend/server.py` line 33
  - Session logs: Creation, cache miss/hit, eviction, error handling
  - No centralized log aggregation detected

## CI/CD & Deployment

**Hosting:**
- Backend: Render.com (primary) or Railway.app (alternative)
  - Render config: `backend/render.yaml` with Python runtime, buildCommand, healthCheckPath
  - Railway config: `backend/railway.json` with NIXPACKS builder
- Frontend: Vercel (native Next.js hosting)
  - Project ID: `prj_xTcvMLFQZSbQ3reSobbW2KGdqSU1` in `.vercel/project.json`

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or Circle CI configuration found

## Environment Configuration

**Required env vars:**
- Backend:
  - `ANTHROPIC_API_KEY` - Anthropic API authentication
  - `SUPABASE_URL` - PostgreSQL database URL (format: `https://[project-id].supabase.co`)
  - `SUPABASE_SERVICE_KEY` - Supabase service role key (service account credentials)
- Frontend:
  - `BACKEND_URL` - FastAPI backend URL (local: `http://localhost:8000`, prod: `https://tarini-backend-xxxx.railway.app`)

**Secrets location:**
- Backend: `.env` file (local dev) or Render/Railway dashboard environment variables (production)
  - Example template: `backend/.env.example`
- Frontend: `.env.local` file (local dev) or Vercel dashboard environment variables (production)
  - Example template: `frontend/.env.local.example`

**WARNING:** Never commit `.env` or `.env.local` files to git. Use `.env.example` templates instead.

## Webhooks & Callbacks

**Incoming:**
- None configured - Tarini is pull-based (frontend initiates chat requests)

**Outgoing:**
- None configured - No event subscriptions or callback URLs

## Request/Response Flow

**Chat Endpoint:**

1. Frontend sends: `POST /api/chat` (Next.js route)
   - Body: `{ session_id, message }`
   - Proxies to: `POST /sessions/{session_id}/chat` (FastAPI backend)

2. Backend processes:
   - Loads session and message history from Supabase (or memory)
   - Calls Anthropic Claude API with system prompt + history
   - Claude may execute tools (get_state, update_state, advance_stage, emit_ui)
   - Streams SSE events back

3. Frontend receives SSE stream:
   - `{"type": "text", "text": "..."}` - Chat text chunk
   - `{"type": "tool_start", ...}` - Tool execution indicator
   - `{"type": "tool_complete", ...}` - Tool result
   - `{"type": "component", ...}` - UI component to render
   - `{"type": "state_snapshot", ...}` - State update
   - `{"type": "done"}` - Stream end

**SSE Keepalives:**
- Sent every 2 seconds during quiet periods to prevent timeout (`backend/server.py` line 82)
- Essential for long-running tool executions and API calls

**Session Endpoint:**

1. Frontend sends: `POST /api/session` (Next.js route)
   - No body required
   - Proxies to: `POST /sessions` (FastAPI backend)

2. Backend returns: `{"session_id": "..."}`

---

*Integration audit: 2026-04-03*
