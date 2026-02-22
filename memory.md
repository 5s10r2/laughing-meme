# Tarini Agent — Project Memory

> Last updated: 2026-02-22
> This file captures key decisions, current architecture state, and open items.

---

## What Is Tarini

Tarini is a conversational AI agent that onboards Indian rental property operators on **RentOK**. No forms — operators describe their property in natural chat (English, Hindi, Hinglish), and Tarini collects, validates, and persists structured listing data.

---

## Current Architecture

### Stack

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js (App Router) | Vercel (`tarini-agent.vercel.app`) |
| Backend | Python 3.12 / FastAPI / uvicorn | Render free tier (`tarini-backend-d79e.onrender.com`), region: Singapore |
| AI | Direct `anthropic` Python SDK, model: `claude-sonnet-4-20250514` | Anthropic API |
| Database | Supabase Postgres (project `rjesrjpsmsyreqlvhfgd`, "Property Onboarding AI") | Supabase |
| Render service ID | `srv-d6d1cc15pdvs739mvarg` | — |

### Key Architectural Decision: Claude Agent SDK -> Direct Anthropic API

**Decision date:** 2026-02-21

**Context:** The original build used `claude-agent-sdk` (Python), which wraps a **Node.js CLI binary as a subprocess**. Locally this worked fine. On Render free tier (512MB RAM), the CLI subprocess caused the `connect()` call to hang indefinitely — the subprocess either OOMed or never responded to the initialize control message.

**Decision:** Rip out `claude-agent-sdk` entirely. Rewrite to use `anthropic>=0.42.0` Python SDK with direct `client.messages.stream()` API calls. No subprocess, no CLI binary.

**What we lost (and what we rebuilt):**
- Session persistence across server restarts -> **Rebuilt** via Supabase JSONB `messages` column
- MCP tool protocol -> Replaced with plain Anthropic tool definitions + `execute_tool()` dispatcher
- Built-in conversation memory -> Replaced with in-memory history + Supabase persistence

**What we gained:**
- Works on Render free tier (no subprocess, ~80MB RAM)
- Faster cold starts
- Full control over streaming, tool loops, error handling
- No dependency on CLI binary versioning

---

## Backend File Map

```
backend/
  server.py                     # FastAPI app, SSE streaming with keepalive bridge
  runtime.txt                   # python-3.12.0
  render.yaml                   # Render service config
  requirements.txt              # anthropic>=0.42.0, supabase, fastapi, uvicorn, pydantic, python-dotenv
  tarini/
    agent.py                    # Streaming tool-use loop (stream_chat), _serialize_content helper
    session_manager.py          # Per-session history, Supabase load/save, eviction, locks
    prompts/
      __init__.py               # load_system_prompt(), INITIAL_PROMPT
      system_prompt.md          # 354-line behavioral prompt (character, stages, tools, rules)
    tools/
      __init__.py               # TOOL_DEFINITIONS (3 tools), execute_tool dispatcher
      state.py                  # get_state, update_state, advance_stage implementations
    db/
      client.py                 # Supabase client: sessions CRUD, load_messages, save_messages
      schema.sql                # Reference DDL (sessions table)
```

---

## SSE Streaming Architecture

The SSE flow uses a **queue bridge pattern**:

1. `_stream_with_keepalives()` (async generator) yields SSE events to the HTTP response
2. `_run_chat()` (background task) iterates `session_manager.chat()` and puts events into an `asyncio.Queue`
3. The SSE generator drains the queue with `asyncio.wait()` timeout for 2-second keepalive pings
4. On `"done"` or `"error"` event, SSE generator breaks and **cancels** the `_run_chat` task in its `finally` block

**Critical gotcha (learned the hard way):**
The SSE generator cancels `_run_chat` immediately after receiving `"done"`. Any code **after** the last `yield` in the `session_manager.chat()` async generator will never execute. Persistence must happen **before** yielding `"done"`, not after.

---

## Conversation Persistence

**Implemented:** 2026-02-22

- Supabase `sessions` table has a `messages JSONB NOT NULL DEFAULT '[]'` column
- `session_manager.chat()`: on cache miss (server restart/eviction), loads history from Supabase via `db.load_messages()`
- Before yielding the `"done"` event, saves history via `db.save_messages()`
- Anthropic SDK content blocks (`TextBlock`, `ToolUseBlock`) are serialized to plain dicts via `_serialize_content()` before storage
- **Verified end-to-end:** conversation survives full server restart on Render

---

## Database Schema (Supabase)

**Table: `sessions`**

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | `gen_random_uuid()` |
| user_id | TEXT | nullable, for future multi-user |
| sdk_session_id | TEXT | **deprecated** — leftover from Agent SDK era |
| stage | TEXT NOT NULL | `'intro'` default. Values: `intro, structure, packages, mapping, verification` |
| state | JSONB NOT NULL | All property data. Deep-merged on update. |
| state_version | INTEGER NOT NULL | Monotonically increasing, incremented atomically via RPC |
| messages | JSONB NOT NULL | Conversation history for persistence. `'[]'` default. |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

**RPC:** `update_session_state_atomic(p_session_id, p_new_state)` — atomic state write + version increment.

---

## Onboarding Stages

Linear progression enforced by prompt (not code):

```
intro -> structure -> packages -> mapping -> verification
```

| Stage | What's captured |
|---|---|
| **intro** | User name, property type, location |
| **structure** | Floors, unit types, unit counts, unit naming |
| **packages** | Rental packages (sharing + furnishing + amenities + rent) |
| **mapping** | Each unit -> its package |
| **verification** | Final summary, blockers, confirmation |

---

## Tools (3 total)

| Tool | Purpose | Key rule |
|---|---|---|
| `get_state` | Read current stage + all property data | Must call at session start before speaking |
| `update_state` | Deep-merge confirmed info into state | Only after user explicitly confirms |
| `advance_stage` | Move to next stage | Only when stage is genuinely complete |

**Deep merge behavior:** Dicts merge recursively. **Lists (floors, units, packages) are overwritten, not appended.** The agent must send the complete array when modifying list fields.

---

## State Schema (defined in system prompt)

```json
{
  "user_name": "string",
  "property_name": "string",
  "property_type": "pg | hostel | flat | studio | rk | coliving | mixed",
  "property_location": "string",
  "floors": [{ "index": 0, "label": "Ground", "active": true }],
  "units": [{
    "id": "unit_001", "name": "Room 101", "floor_index": 0,
    "category": "pg_room | flat | studio | rk | hostel_dorm",
    "sharing_type": "private | double | triple | dormitory",
    "bhk_variant": "1BHK | 2BHK | ...",
    "package_id": "pkg_001", "active": true
  }],
  "packages": [{
    "id": "pkg_001", "name": "AC Double Sharing",
    "category": "pg_room", "sharing_type": "double",
    "furnishing": "fully_furnished | semi_furnished | unfurnished",
    "amenities": ["AC", "WiFi", "attached washroom"],
    "food_included": false, "food_optional": false,
    "starting_rent": 9000, "active": true, "disabled": false
  }],
  "naming_patterns": { "0": { "pattern": "Room 1{nn}", "start": 1 } }
}
```

---

## Capability Audit (2026-02-22)

Against the exhaustive 116-item capability list:

| Category | Verdict |
|---|---|
| Structure & Floors | **Handled** (prompt + state schema). Array-replacement for deletions is fragile but functional. |
| Unit Types & Inventory | **Handled.** Custom BHK/Studio/RK variants weakly supported (no explicit field, agent improvises). |
| Unit Naming | **Handled.** |
| Rental Packages | **Handled.** Disable vs delete, starter suggestions, lifecycle — all in prompt. |
| Attributes & Amenities | **Handled.** Flexible amenities array covers operator-defined highlights. |
| Mapping & Remapping | **Handled.** Deletion-blocking and remap guidance are prompt-only (no code enforcement). |
| Conversation Quality | **Handled deeply.** One question per turn, confirm before save, out-of-order info, error recovery. |
| Language & Personalization | **Handled.** Hindi/Hinglish mirroring, anti-name-confusion, no jargon. |
| Progress & Memory | **Handled.** Persistence implemented. Resume, recap, safe start-over all work. |
| Safety & Trust | **Handled.** Ambiguous = no mutation, destructive = confirm, no false claims. |
| **AI <-> UI Cohesion** | **NOT HANDLED.** No card system, no CTAs, no quick actions, no step cards. Frontend is plain chat only. |
| Error Recovery | **Handled.** 3-tier escalation, never dead-end. |
| Completion & Handoff | **Handled.** Final summary, blockers, confirmation, next step. |

**Score: 97/116 handled, 12 fragile (prompt-only enforcement), 7 missing (all AI<->UI).**

---

## Known Gaps — Product-Level (PM Audit, 2026-02-22)

### P0 — Can't ship a real listing without these

1. **Gender preference** — PGs are almost always male-only, female-only, or co-ed. Tenants filter by this first. Not in state schema.
2. **Security deposit** — Every tenant asks. Every listing needs it. Not captured.
3. **Lock-in period / Notice period** — Standard in Indian rentals. Not captured.

### P1 — Major UX gaps

4. **Structured summary cards** — Operators can't see what they've configured. Everything is text-in-text-out. Need visual confirmation (the AI<->UI Cohesion gap).
5. **Quick reply / suggested action buttons** — Most operators are on mobile. Typing "yes" or "AC Double Sharing" on phone keyboard = friction. Suggested replies would cut effort massively.
6. **Photo capture flow** — A listing without photos is dead. No photo handling at all.
7. **Mobile response length** — Prompt says "flowing sentences" but on a 6-inch screen, long paragraphs are a wall. Need mobile-aware brevity guidance.

### P2 — Important for listing quality

8. **House rules** — Curfew, guest policy, smoking, pets, food policy. PG operators care deeply.
9. **Pricing depth** — Maintenance charges, electricity (included/metered?), food charges if optional.
10. **Listing preview** — "Here's what tenants will see" before completion. Builds trust, catches errors.
11. **Rent validation** — If someone sets private AC room in Koramangala at Rs 2,000/month, flag it.

### P3 — Future

12. **Multi-property** — Many operators manage 3-5 PGs. No way to duplicate setup across properties.
13. **Post-onboarding editing** — Come back to update pricing, mark rooms occupied, add photos later.
14. **Time-aware resume** — "It's been 2 days" vs "Welcome back!" after 5 minutes should feel different.

---

## Render Deployment Notes

- **Auto-deploy from git push does NOT trigger.** All deploys have been `trigger: "api"`. Workaround: change `DEPLOY_TRIGGER` env var via Render API to force redeploy.
- **Free tier:** 512MB RAM, spins down after ~15 min idle. Cold start ~20-30s.
- **Python version:** Pinned to `3.12.0` via both `runtime.txt` and `PYTHON_VERSION` env var. Without both, Render defaulted to Python 3.14.3 which caused anyio issues.
- **Two instances sometimes appear during deploys** (old instance shutting down, new one starting). This is normal blue-green behavior.

---

## Environment Variables (Backend)

| Var | Where |
|---|---|
| `ANTHROPIC_API_KEY` | Render env |
| `SUPABASE_URL` | Render env |
| `SUPABASE_SERVICE_KEY` | Render env |
| `PYTHON_VERSION` | Render env (`3.12.0`) |
| `DEPLOY_TRIGGER` | Render env (used to force redeploys) |

---

## Git History (Key Commits)

| Commit | What |
|---|---|
| `ce6e7a1` | **refactor:** Replace Claude Agent SDK with direct Anthropic API |
| `1609c6a` | **feat:** Persist conversation history to Supabase |
| `34e48e4` | **fix:** Save history before yielding done (task cancellation bug) |

---

## Documentation Files

**`memory.md`** (this file) — Architecture decisions, project state, key learnings. Quick reference.

**`documentation.md`** — Complete developer recreation guide. Every file, every line of code, deployment steps. Fully rewritten on 2026-02-22 to reflect the current direct-API architecture (v2.0).

**`doc.md`** — Deleted on 2026-02-22. Was a 412-line architecture overview that referenced the old Claude Agent SDK, MCP tools, Railway deployment. Its role is now served by `memory.md` (for decisions/state) and `documentation.md` (for full code).
