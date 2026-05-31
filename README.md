# Tarini — Conversational Property Onboarding Agent

Tarini is an AI agent that onboards Indian rental property operators onto RentOK. No forms — operators describe their property in natural chat (English, Hindi, Hinglish), and Tarini collects, validates, and persists structured listing data.

**Live:** [tarini-agent.vercel.app](https://tarini-agent.vercel.app)

---

## Stack

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Vercel |
| Backend | Python 3.12, FastAPI, uvicorn | Render |
| AI | Anthropic SDK (`claude-sonnet-4-20250514`) | Anthropic API |
| Database | Supabase Postgres (JSONB snapshots) | Supabase |

---

## Repo structure

```
tarini/
├── backend/          # Python FastAPI server + domain logic
│   ├── server.py     # HTTP entry point (FastAPI routes)
│   ├── tarini/
│   │   ├── agent.py          # Anthropic streaming loop
│   │   ├── flags.py          # All env-var switches (single source of truth)
│   │   ├── domain/           # Pure domain — Property aggregate, Space tree, Offerings
│   │   ├── application/      # CommandService, TreeCommandService, codec
│   │   ├── ports/            # Abstract repository + publish gateway interfaces
│   │   └── adapters/         # Supabase + in-memory implementations
│   └── tests/        # 290 unit + integration tests
└── frontend/         # Next.js app
    ├── app/
    │   ├── api/      # Proxy routes → backend
    │   └── components/
    │       └── blueprint/  # Living Blueprint UI components
    └── design/
        └── prototypes/ # design-system.html (canonical design contract)
```

---

## Running locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Minimum env (in-memory DB, no Supabase needed)
export ANTHROPIC_API_KEY=sk-ant-...
export ALLOW_IN_MEMORY_DB=true
export USE_NEW_EXPERIENCE=1
export USE_TREE_MODEL=1

uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install

# .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_USE_NEW_EXPERIENCE=1
TARINI_API_KEY=any-local-key   # must match backend TARINI_API_KEY if set

npm run dev -- --port 3001
```

### Running tests

```bash
cd backend
python -m pytest
```

---

## Environment variables

### Backend (Render)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `SUPABASE_URL` | Prod | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Prod | — | Supabase service role key |
| `ALLOW_IN_MEMORY_DB` | Dev only | `false` | Skip Supabase for local dev |
| `USE_NEW_EXPERIENCE` | — | `false` | Enable redesigned backend (v2 tools + CommandService) |
| `USE_TREE_MODEL` | — | `false` | Enable recursive Space tree domain (requires `USE_NEW_EXPERIENCE`) |
| `ENABLE_UI_COMPONENTS` | — | `true` | Set to `0` for pure-text chat (no generative UI) |
| `MODEL_NAME` | — | `claude-sonnet-4-20250514` | Override the Claude model |
| `TARINI_API_KEY` | — | — | Bearer token for API auth (optional) |

### Frontend (Vercel)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend base URL |
| `NEXT_PUBLIC_USE_NEW_EXPERIENCE` | Show new-experience UI shell |
| `TARINI_API_KEY` | Passed as `Authorization: Bearer` to backend |

---

## Feature flags

All flags default OFF — the legacy path runs unchanged until explicitly activated.

```
USE_NEW_EXPERIENCE=1          → redesigned backend (v2 streaming, CommandService)
USE_TREE_MODEL=1              → recursive Space tree domain (PG/flat/hostel/serviced)
NEXT_PUBLIC_USE_NEW_EXPERIENCE=1  → new UI shell + Living Blueprint panel
```

Rollback: unset `USE_NEW_EXPERIENCE` on Render → legacy instantly, no deploy needed.

---

## Key architectural decisions

- **Typed command pattern** — all mutations go through `CommandService.apply(commands)`. The agent calls it via tools; the frontend Blueprint panel calls it directly via `POST /sessions/:id/commands`. No raw state mutation.
- **Optimistic concurrency** — every `apply` call takes `expected_version`; the Supabase `save_property_snapshot` RPC is a CAS operation.
- **Recursive Space tree** — `Property → Block? → Floor? → Flat? → Room? → Bed?` with a rank grammar (`can_contain`). Handles PG, apartment buildings, serviced apartments, and mixed-use without branching.
- **Generative UI** — Claude calls `emit_ui` with a component name; backend projects the model onto props (never trusts Claude-authored props for blueprint components); frontend renders them inline in chat.

---

## Deployment

Backend auto-deploys to Render on push to `main` (`render.yaml`).  
Frontend auto-deploys to Vercel on push to `main`.

Render free tier has ~50s cold start after 15 min idle. Upgrade to Starter ($7/mo) to eliminate this.

---

## Database migrations

```sql
-- Apply in order to Supabase SQL editor
backend/db/migrations/0001_initial.sql
backend/db/migrations/0002_property_redesign.sql   -- required for USE_NEW_EXPERIENCE
```
