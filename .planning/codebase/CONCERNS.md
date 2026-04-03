# Codebase Concerns

**Analysis Date:** 2026-04-03

## Critical Infrastructure Limits

**Render Free Tier Memory Constraint (512MB):**
- Problem: Backend runs on Render's free tier with only 512MB RAM. In-memory session cache can grow unbounded if sessions are not properly evicted or if large conversation histories accumulate.
- Files: `backend/tarini/session_manager.py` (lines 25-26: `_IDLE_TTL_SECONDS` and `_EVICTION_INTERVAL_SECONDS`), `backend/server.py` (lines 41-50: lifespan)
- Risk: As user base grows, memory fragmentation could crash the backend. Free tier has no auto-restart guarantee.
- Improvement path: Implement per-session memory limits, add memory monitoring/alerting, consider forced eviction thresholds, or migrate to Railway/Heroku paid tier with more predictable performance.

**Supabase Connection Pool Exhaustion:**
- Problem: `backend/tarini/db/client.py` creates one async Supabase client at startup but doesn't implement connection pooling. High concurrency during peak onboarding could exhaust free-tier connection limits.
- Files: `backend/tarini/db/client.py` (lines 30-52)
- Risk: Backend becomes unresponsive when connection pool fills; users see "Backend unavailable" errors.
- Improvement path: Implement connection pooling in Supabase SDK or use managed connection pooling (PgBouncer). Set connection limits and implement request queuing with backpressure.

**Synchronous History Serialization in Hot Path:**
- Problem: Every chat turn serializes full message history to JSONB in Supabase via `db.save_messages()`. With long conversations (e.g., 100+ turns), this becomes a blocking I/O operation that slows down SSE response delivery.
- Files: `backend/tarini/session_manager.py` (lines 77-92), `backend/tarini/db/client.py` (lines 122-134)
- Risk: User perceives lag in the chat stream as message persistence blocks the event loop.
- Improvement path: Implement async batching (persist every N messages or on timeout rather than every message), or move persistence to a background queue (Redis, message broker).

---

## Data Loss & Persistence Gaps

**Message Persistence After "done" Event:**
- Problem: In `backend/tarini/agent.py` (lines 81-92), messages are only persisted BEFORE yielding "done". If the SSE stream is cancelled after "done" is yielded but before persistence completes, the conversation turn is lost on server restart.
- Files: `backend/tarini/session_manager.py` (lines 77-92)
- Risk: Users may repeat information on reconnect if they disconnect mid-stream.
- Workaround: None. Users should wait for visible confirmation.
- Fix: Persist messages before yielding "done", OR use a durability guarantee that saves synchronously and only then yields.

**Session Orphan Recovery:**
- Problem: If a Supabase query fails during session creation (`backend/tarini/db/client.py` lines 88-93), the `create_session()` call returns but the session may be partially created in the database. Frontend receives a session_id that doesn't fully initialize.
- Files: `backend/tarini/db/client.py` (lines 70-93), `frontend/app/components/ChatUI.tsx` (lines 39-67)
- Risk: Frontend stores a dead session_id in localStorage, user gets error messages forever.
- Improvement path: Add explicit session initialization verification (check `state`, `messages` exist) before returning session_id.

**In-Memory Store Not Replicated:**
- Problem: When Supabase is unavailable, `backend/tarini/db/client.py` falls back to `_mem_sessions` dict. This is process-local — if the backend restarts, all sessions in `_mem_sessions` are lost.
- Files: `backend/tarini/db/client.py` (lines 19-52)
- Risk: Users hit Supabase outage, continue onboarding in fallback mode, backend restarts → all work lost.
- Improvement path: Log a clear error to users when in-memory fallback is active. Implement periodic snapshots to a file or temporary storage, or refuse new sessions when Supabase is down.

---

## Infinite Loop & Resource Exhaustion

**Tool-Use Loop Safety Limit Weak:**
- Problem: `backend/tarini/agent.py` line 27: `MAX_TOOL_ROUNDS = 10` prevents infinite loops but 10 rounds is loose. A misbehaving system prompt or model state could still consume significant API quota and delay user response.
- Files: `backend/tarini/agent.py` (lines 27, 92, 288)
- Risk: Runaway tool loops hit API rate limits or cost overruns. No explicit cost tracking per session.
- Improvement path: Reduce `MAX_TOOL_ROUNDS` to 5, implement per-session token budget tracking, add timeouts per round.

**No Input Validation on User Messages:**
- Problem: `backend/server.py` (line 72) accepts user messages with only a `max_length=8000` check but no content validation (e.g., no check for injection patterns, encoding issues, or binary data).
- Files: `backend/server.py` (lines 71-72)
- Risk: Malformed UTF-8, null bytes, or crafted payloads could cause JSON serialization failures or prompt injection.
- Improvement path: Validate and sanitize input using `str.encode('utf-8').decode('utf-8')` and reject non-text patterns.

**Unbounded API History Trimming Window:**
- Problem: `backend/tarini/agent.py` (lines 35-44) trims history to `_MAX_API_HISTORY = 20` messages for cost control, but full history (unlimited size) is persisted. Long conversations accumulate without bound.
- Files: `backend/tarini/agent.py` (lines 28, 35-44), `backend/tarini/db/client.py` (lines 105-119)
- Risk: JSONB field grows unbounded; Supabase row size or query time degrades.
- Improvement path: Implement hard cap on total message history (e.g., keep last 200 messages, archive older ones), or implement message compression/pruning for very old turns.

---

## Security Gaps

**CORS Allows All Origins:**
- Problem: `backend/server.py` (lines 58-64): `allow_origins=["*"]` accepts requests from any domain without authentication or rate limiting.
- Files: `backend/server.py` (lines 58-64)
- Risk: CSRF attacks from third-party sites, session hijacking if frontend is cloned by attacker, abuse by automated bots.
- Improvement path: Whitelist only `frontend.example.com` (or Vercel URL). Add CSRF token validation. Implement rate limiting per IP or session.

**No API Key Validation for Backend Endpoints:**
- Problem: Session creation and chat endpoints (`POST /sessions`, `POST /sessions/{id}/chat`) have no authentication. Any client can create unlimited sessions and trigger LLM calls.
- Files: `backend/server.py` (lines 146-183)
- Risk: DDoS via session creation spam, API quota abuse, cost overruns.
- Improvement path: Add optional API key header validation, implement rate limiting (per IP, per user), use Vercel environment secrets to seed a backend key.

**Session ID Not Cryptographically Unique Enough:**
- Problem: Session IDs are UUIDs generated by Postgres (`gen_random_uuid()`), which is cryptographically strong. However, they're exposed in localStorage and HTTP headers without encryption. If leaked, attacker can hijack conversations.
- Files: `frontend/app/components/ChatUI.tsx` (lines 41-46), `backend/server.py` (line 149)
- Risk: Cross-site scripting (XSS) could steal session_id from localStorage. Man-in-the-middle could intercept unencrypted session_id.
- Mitigation: None deployed. Sessions are assumed trusted if you have the ID.
- Fix: Implement session token rotation, store session_id in HttpOnly cookies (backend-set), add HTTPS enforcement.

**Error Messages Leak Internal Structure:**
- Problem: `backend/tarini/tools/__init__.py` (line 122) returns raw component validation errors to Claude: `f'{{"error": "{error}"}}'`. These get echoed to the user via SSE, revealing available components and internal validation.
- Files: `backend/tarini/tools/__init__.py` (lines 120-125)
- Risk: Minor — helps attacker understand internal structure but doesn't expose secrets.
- Improvement path: Return generic errors to Claude, log detailed errors server-side only.

---

## Testing & Quality Gaps

**No Test Coverage:**
- Problem: Zero test files in the entire codebase (`backend/` and `frontend/` have no `*.test.*` or `*.spec.*` files).
- Files: All files
- Risk: Regressions go undetected, refactoring breaks hard-to-reproduce code paths, critical bugs reach production.
- Blocks: Cannot safely refactor session manager, agent loop, or database layer.
- Priority: **High** — at minimum, add tests for:
  - Session creation and recovery after server restart
  - Tool execution and error handling
  - SSE stream integrity (text, component, tool events)
  - State merging and version increments
  - Database fallback behavior

**No Monitoring or Logging Dashboards:**
- Problem: Logging is basic (Python `logging` module, no structured logs). No error tracking (Sentry), no performance monitoring (New Relic, Datadog), no SLA metrics.
- Files: `backend/server.py` (lines 33-34), `backend/tarini/agent.py` (lines 24, 96-99), `backend/tarini/session_manager.py` (lines 23)
- Risk: Production bugs are invisible until users complain. Hard to debug Render restart loops or Supabase connection failures.
- Improvement path: Add Sentry for error tracking, implement structured logging (JSON), hook up Vercel/Render dashboards.

**No Load Testing:**
- Problem: No benchmark suite to test concurrency limits, memory growth, or API latency at scale.
- Files: Entire codebase
- Risk: Unknown scalability limits. First production spike could cause crashes.
- Improvement path: Create synthetic load test (50-100 concurrent users). Test memory footprint over 24h. Identify bottlenecks.

---

## Known Behavioral Issues

**Cold Start Latency on Render:**
- Problem: Render's free tier spins down inactive backends. First request after spin-down takes 30-90 seconds (Python startup + dependency imports + Supabase connection).
- Files: `backend/server.py`, `backend/tarini/db/client.py`
- Workaround: Frontend comments (line 1 in `app/api/session/route.ts`, `app/api/chat/route.ts`) acknowledge this with edge runtime. Users see "Connecting to Tarini…" spinner.
- Fix: Migrate to paid tier with always-on instances, or implement frontend retry with exponential backoff.

**SessionManager Eviction Deletes Active Sessions:**
- Problem: `backend/tarini/session_manager.py` (lines 120-130) evicts idle sessions every 5 minutes if they haven't been used in 30 minutes. If a user walks away and comes back, their session is gone.
- Files: `backend/tarini/session_manager.py` (lines 25-26, 120-130)
- Risk: User returns to onboarding UI, assumes their data is saved, but session is removed.
- Mitigation: Session data IS persisted to Supabase, so `db.load_messages()` rehydrates on cache miss. User sees old conversation history. This is acceptable but confusing.
- Improvement path: Increase `_IDLE_TTL_SECONDS` to 24h, or log when sessions are evicted so users can understand what happened.

**Tool Validation Errors Not Shown to User:**
- Problem: `backend/tarini/agent.py` (lines 154-162): if `emit_ui` validation fails, the error is returned as tool result to Claude, but Claude sees it as a successful tool execution (because the tool executed). Frontend never sees the validation error.
- Files: `backend/tarini/agent.py` (lines 150-172), `backend/tarini/tools/ui.py` (lines 36-47)
- Risk: Claude might silently skip rendering an invalid component and move on, confusing the user.
- Improvement path: Emit an error event to the user when component validation fails, or make Claude aware that validation failed (return different tool result format).

**State Version Tracking Not Validated:**
- Problem: `backend/tarini/agent.py` (lines 214-227) emits `stateVersion` after `update_state`, but frontend's `OnboardingStateContext` (line 18) doesn't use version for cache invalidation or conflict detection. Multiple simultaneous updates could lose data.
- Files: `backend/tarini/agent.py` (lines 214-227), `frontend/app/context/OnboardingStateContext.tsx` (lines 28-39)
- Risk: If user opens two tabs and updates state in both, one update may be lost.
- Improvement path: Add optimistic locking (reject update if version mismatch), or implement last-write-wins with user notification of conflicts.

---

## Fragile Areas

**SSE Stream Parsing Brittle:**
- Problem: `frontend/app/lib/sse-parser.ts` (lines 11-50) silently skips malformed JSON or unrecognized event types (lines 42-44). No explicit error event type.
- Files: `frontend/app/lib/sse-parser.ts` (lines 11-50)
- Risk: If backend sends invalid JSON in an SSE line, the frontend silently drops the event and may miss critical data.
- Safe modification: Add explicit error handling that either (a) yields an error event, or (b) logs to console for debugging.
- Test coverage gap: No tests for malformed SSE lines.

**ChatUI Message History Not Synced to Backend:**
- Problem: `frontend/app/components/ChatUI.tsx` (lines 27-29) maintains local message state with `useState`, but this is never persisted or synced. If browser closes, all visible messages are lost even though backend persisted the turn.
- Files: `frontend/app/components/ChatUI.tsx` (lines 27-29)
- Risk: User expects browser history to survive reload, but it doesn't.
- Safe modification: Load messages from backend on init via `/api/session/{id}` endpoint, or implement React Query to sync frontend state.
- Blocks: Requires adding a `GET /sessions/{id}` endpoint handler in frontend (already exists in backend but not called by frontend).

**Component Registry Not Validated at Compile Time:**
- Problem: `frontend/app/lib/component-registry.tsx` maps component names to React components, but `backend/tarini/tools/ui.py` (lines 12-33) defines `AVAILABLE_COMPONENTS` as a hardcoded set. If backend and frontend diverge, runtime errors occur.
- Files: `frontend/app/lib/component-registry.tsx`, `backend/tarini/tools/ui.py` (lines 12-33)
- Risk: Add new component to frontend, forget to add to backend whitelist → user sees "Unknown component" error in production.
- Improvement path: Generate component registry from shared schema (e.g., JSON file, or use TypeScript generics).

**Direct Database State Mutations Not Atomic:**
- Problem: `backend/tarini/db/client.py` (lines 157-173): `advance_stage()` is a simple UPDATE without atomic state merge. If `update_state()` and `advance_stage()` are called in the same turn, there's a race condition on the Supabase side.
- Files: `backend/tarini/db/client.py` (lines 157-173), `backend/tarini/tools/state.py` (lines 81-95)
- Risk: Rare but possible: stage is updated before state is fully saved, causing inconsistency.
- Safe modification: Use a Supabase transaction or create an `advance_stage_atomic()` RPC that updates both stage and state in one statement.

---

## Scaling Limits

**In-Memory Session Cache Grows Linearly:**
- Problem: `backend/tarini/session_manager.py` (lines 29-38) stores all session histories in a dict (`_histories`). With 1000 concurrent users (each with 20-message history), this is ~1-2MB of RAM just for message data, plus overhead for locks and timestamps.
- Files: `backend/tarini/session_manager.py` (lines 29-38, 73-75)
- Current capacity: ~500-1000 concurrent users on 512MB RAM before memory pressure.
- Limit: Hit 512MB RAM limit at ~2000 concurrent sessions.
- Scaling path: Move session storage to Redis, or implement LRU eviction with disk spillover.

**API Rate Limit on Anthropic Not Enforced:**
- Problem: No per-session or per-user rate limiting on Claude API calls. A single user can spam `/chat` endpoint and consume quota.
- Files: `backend/server.py` (lines 167-183)
- Current capacity: Unlimited API calls per user.
- Limit: Hit Anthropic rate limits or monthly token budget.
- Scaling path: Add token counting, implement quota tracking per user/session, reject requests that exceed budget.

**Supabase Free Tier Database Limits:**
- Problem: Free tier Supabase has 500MB storage. With JSON message histories, this fills quickly.
- Files: `backend/tarini/db/schema.sql`, `backend/tarini/db/client.py`
- Current capacity: ~1000-5000 completed sessions depending on message history size.
- Limit: Database full after ~5000 sessions.
- Scaling path: Archive old sessions to cold storage (S3), implement message compression, or upgrade to Pro tier ($25/month).

---

## Dependencies at Risk

**Python 3.12.0 Pinned to Exact Version:**
- Problem: `backend/runtime.txt` pins `python-3.12.0` to exact version. This is unnecessarily strict; should use `3.12` to allow patch updates.
- Files: `backend/runtime.txt`
- Risk: Security patches for 3.12.1, 3.12.2 are not applied.
- Improvement path: Change to `python-3.12`.

**Anthropic SDK Version Loose:**
- Problem: `backend/requirements.txt` (line 1): `anthropic>=0.42.0` allows any version ≥0.42.0. Major version bumps could break API calls.
- Files: `backend/requirements.txt`
- Risk: SDK upgrade to 1.0.0 might change API (e.g., return types, exception names).
- Improvement path: Pin to range: `anthropic>=0.42.0,<1.0.0`.

**Supabase Python SDK Stability:**
- Problem: `backend/requirements.txt` (line 2): `supabase==2.28.0` is exact but 2.x is still pre-1.0. Breaking changes are expected.
- Files: `backend/requirements.txt`
- Risk: Update might require code changes.
- Monitoring: Check Supabase Python changelog monthly.

**Next.js / React Recent Versions:**
- Problem: `frontend/package.json` uses very recent versions (Next.js 16.1.6, React 19.2.3). Bleeding edge = more bugs.
- Files: `frontend/package.json`
- Risk: Unexpected behavior or performance regressions in new Next.js/React versions.
- Improvement path: Wait 2-3 patch versions before upgrading major versions (use Next.js LTS instead).

---

## Missing Critical Features

**No Session Persistence Between Restarts (For Active Sessions):**
- Problem: When backend restarts, all in-memory session state (`_histories`, `_query_locks`, `_last_used`) is lost. Only the message history is reloaded from Supabase on cache miss.
- Files: `backend/tarini/session_manager.py`, `backend/server.py` (lines 41-49)
- Impact: Users in the middle of a chat lose the SSE connection. Frontend sees network error and retries. Conversation continues, but user sees a visual hiccup.
- Workaround: Built-in — `session_manager.chat()` reloads history from DB on cache miss (line 71).
- Improvement path: Persist session lock state and last-used timestamps to Redis or Supabase, or accept the brief reconnect hiccup as acceptable.

**No Explicit Session Timeout Notification:**
- Problem: Sessions are silently evicted after 30 minutes. Frontend has no way to know and keeps the old session_id in localStorage.
- Files: `backend/tarini/session_manager.py` (lines 120-130), `frontend/app/components/ChatUI.tsx` (lines 41-46)
- Impact: User thinks their session is active, but it's gone. Next message request fails with "Session not found".
- Improvement path: Backend should emit a `session_timeout` event to active SSE streams before eviction, or frontend should poll `/sessions/{id}` to validate.

**No Graceful Degradation for Partial Supabase Outages:**
- Problem: If Supabase is slow (not fully down), requests hang until timeout. No circuit breaker.
- Files: `backend/tarini/db/client.py` (lines 30-52, 148-154)
- Risk: Cascade failure — slow Supabase → slow backend responses → frontend timeout → user refreshes → more load.
- Improvement path: Add timeout and circuit breaker (e.g., fail fast after 5s, fallback to in-memory).

**No User-Facing Error Recovery Guide:**
- Problem: When errors occur, users see generic messages ("An error occurred. Please try again."). No guidance on what to do.
- Files: `backend/server.py` (line 102), `frontend/app/components/ChatUI.tsx` (lines 263-273)
- Risk: User frustration, support burden.
- Improvement path: Return specific error codes (e.g., "SESSION_EXPIRED", "BACKEND_DOWN"), render helpful messages ("Session expired. Starting fresh…", "Backend is restarting. Please wait…").

---

## Test Coverage Gaps

**Core Session Logic Untested:**
- What's not tested: Session creation, recovery after server restart, message persistence, idle eviction.
- Files: `backend/tarini/session_manager.py`, `backend/tarini/db/client.py`
- Risk: Regression in session lifecycle could go unnoticed.
- Priority: **High** — write integration tests simulating server restart, long conversations, eviction.

**Tool Execution Untested:**
- What's not tested: Tool dispatch, error handling, state merging, component validation.
- Files: `backend/tarini/tools/__init__.py`, `backend/tarini/tools/state.py`, `backend/tarini/tools/ui.py`
- Risk: Tool bugs reach production, breaking user onboarding.
- Priority: **High** — write unit tests for each tool function.

**SSE Stream Integrity Untested:**
- What's not tested: Partial reads, malformed JSON, connection drops, keepalive timing.
- Files: `backend/server.py` (lines 79-139), `frontend/app/lib/sse-parser.ts`
- Risk: Rare stream corruption scenarios go undetected.
- Priority: **Medium** — write fuzz tests for SSE parsing.

**Frontend State Management Untested:**
- What's not tested: Message accumulation, component rendering, quick replies, error recovery.
- Files: `frontend/app/components/ChatUI.tsx`, `frontend/app/context/OnboardingStateContext.tsx`
- Risk: UI regressions, broken message display, missing context updates.
- Priority: **Medium** — use React Testing Library to test ChatUI event handling.

**End-to-End Onboarding Flow Untested:**
- What's not tested: Full user journey from session creation through all 5 stages.
- Files: All backend + frontend files
- Risk: Stage transitions, state persistence, UI component rendering could all fail in combination.
- Priority: **Medium** — write Playwright/Cypress E2E tests.

---

*Concerns audit: 2026-04-03*
