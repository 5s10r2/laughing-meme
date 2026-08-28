# Tarini

**A property owner describes their building in a WhatsApp-style chat, in Hindi, English or Hinglish, and a complete, validated RentOk listing comes out the other end. No forms.**

Onboarding a PG or hostel onto RentOk today means a sales person sitting with the owner and filling in floors, rooms, beds, sharing types and rents by hand. Tarini replaces that with a conversation. The owner talks the way they already talk ("teen floor hain, har floor pe 4 room"), and the system builds the structured property model underneath, checks it for gaps, and shows the owner a live picture of what it has understood.

**Live:** [tarini-agent.vercel.app](https://tarini-agent.vercel.app) · [![CI](https://github.com/5s10r2/tarini-property-onboarding/actions/workflows/ci.yml/badge.svg)](https://github.com/5s10r2/tarini-property-onboarding/actions/workflows/ci.yml)

[What it does](#what-it-does) · [Who should read what](#who-should-read-what) · [Where it stands](#where-it-stands-today) · [How it works](#how-it-works) · [Run it](#run-it-in-five-minutes) · [Reference](#reference) · [Questions](#questions)

---

## What it does

One real turn, taken from the golden-flow tests in `backend/tests/golden/test_golden_flows.py`. The owner types plain sentences on the left. The middle column is what the model actually emits: typed commands, not free text. The right column is the state after the turn.

| The owner says | Tarini emits | Property model now holds |
|---|---|---|
| "Cozy Nest, PG in Indiranagar" | `SetProperty(name, type, location)` | property identified, structure empty |
| "ek floor hai" | `AddFloors(count=1, start_index=1)` | Floor 1 |
| "us floor pe 3 room" | `SetFloorRooms(floor_id, count=3)` | 3 rooms on Floor 1 |
| "basic triple 6000, premium single 14000" | `CreatePackage` x2 | 2 rent packages priced |
| "saare basic hain" | `MapRooms(room_ids, package_id)` | 3 rooms priced, listing publishable |

Two things to notice. First, the owner never gave an id for anything, and never filled a field. Second, the model never writes to the database directly. It emits commands that the backend validates and applies, so a confused or creative answer from the model cannot corrupt a listing.

Corrections work the same way, because they are just more commands. The owner can rename a floor, move rooms to a different package, or mark a room unavailable at any point, in any order. There is no wizard to back out of.

---

## Who should read what

| If you are | Your question is | Start here |
|---|---|---|
| **Srijan** (CEO) | Is this worth backing, and what does it change commercially? | [Where it stands today](#where-it-stands-today), then the two-minute demo at [tarini-agent.vercel.app](https://tarini-agent.vercel.app) |
| **Nimit** (CTO) | Is the architecture sound enough to build on, or is it a demo held together with string? | [How it works](#how-it-works) and `backend/docs/redesign/02-ARCHITECTURE.md` (the target architecture spec) |
| **Jatin** (backend lead) | Can my team own this, and what would it take to ship? | [Run it in five minutes](#run-it-in-five-minutes), then `backend/tarini/domain/` (the pure business rules, no framework code) |
| Anyone cloning it | How do I get it running? | [Run it in five minutes](#run-it-in-five-minutes) |

---

## Where it stands today

This is a proof of concept that has been through one full hardening pass, not a first draft. Being straight about both halves:

**What works end to end**

- A full onboarding conversation, in English, Hindi or Hinglish, from "what is your property called" through to a priced, validated, publishable listing.
- Four property shapes, without separate code paths for each: a PG, hostel or co-living where rooms and beds are sold by sharing; a flat or apartment building let by BHK; individual rooms inside a flat; and a serviced apartment. The structure is one recursive tree (`Property > Block > Floor > Flat > Room > Bed`) where every level is optional, so a PG is shallow (`property > floor > room`) and an apartment building is deep (`property > floor > flat > room`).
- Corrections and out-of-order answers. There is no fixed question sequence to complete.
- A live picture of the property, the Living Blueprint panel, that updates as the conversation goes and can be edited directly. Editing the panel and talking to Tarini go through the same command path, so the two can never disagree.
- 304 backend tests, all passing, including golden flows that replay whole conversations and fail loudly if behaviour drifts.
- Error tracking (Sentry), onboarding funnel stats, and feature flags that roll the whole redesign back by unsetting one environment variable, with no redeploy.

**What is deliberately not built yet**

- **Writing the finished listing into RentOk.** This is the big one. The connection point exists and is fully isolated (`backend/tarini/ports/publish_gateway.py`), but the only implementation behind it today is a stub that logs and returns success (`backend/tarini/adapters/stub_publish_gateway.py`). It was left stubbed because the contract RentOk expects was an open question. **Give us that contract and the last mile is one adapter, with no changes anywhere else.** That is the single decision this repo is waiting on.
- Multi-property owners and tenancy lifecycle, deferred by decision during the May 2026 architecture review.
- Translated interface copy. The agent understands and replies in Hindi and Hinglish, but the surrounding buttons and labels are English only.
- Real authentication. There is an optional shared bearer token, which is fine for a pilot and not fine for public traffic.

**Known rough edge:** the backend runs on Render's free tier, so the first request after 15 idle minutes takes about 50 seconds to wake. If you open the live link and it hangs, that is what you are seeing. Seven dollars a month removes it.

---

## How it works

```
Browser
  └─ Next.js app (Vercel)          chat UI + Living Blueprint panel
       └─ /api/chat proxy          adds auth, streams server-sent events through
            └─ FastAPI (Render)    session handling, streaming, keepalives
                 └─ agent loop     Claude with exactly three tools
                      └─ CommandService   validates and applies typed commands
                           └─ Supabase    JSONB snapshot per property
```

Four decisions carry the whole design.

**The model gets three tools, not thirty.** `get_model` reads current state, `apply_commands` changes it, `emit_ui` renders a component into the chat. Every property change in the system flows through the second one. A small tool surface is why the behaviour stays predictable as the conversation gets messy.

**Business rules are pure and framework-free.** `backend/tarini/domain/` holds the property, space, offering, completeness and invariant rules with no FastAPI, no Supabase and no Anthropic imports anywhere in it. The database sits behind an interface (`ports/`) with two implementations (`adapters/`): Supabase for real use, in-memory for tests. That is why all 304 tests run with no database and no API key.

**Structure is one recursive tree, not four templates.** A rank grammar (`can_contain` in `domain/space.py`) decides what can hold what, so a hostel with beds in rooms and an apartment block with flats on floors are the same code at different depths. Adding a new property shape does not mean a new branch.

**Concurrent edits cannot silently overwrite each other.** Every apply carries the version it expects, and the Supabase write is compare-and-set. If the owner edits the blueprint panel while Tarini is mid-sentence, one of them is told to retry rather than quietly winning.

For the reasoning behind all of this, `backend/docs/redesign/` holds the May 2026 audit (a module-by-module read of the previous version), the target architecture, the decisions and plan, and the engineering standards the code is held to.

---

## Run it in five minutes

You need Python 3.12, Node 20, and an Anthropic API key. No database required: the in-memory adapter covers local use.

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
export ALLOW_IN_MEMORY_DB=true USE_NEW_EXPERIENCE=1 USE_TREE_MODEL=1
uvicorn server:app --reload --port 8001
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:8001' > .env.local
echo 'NEXT_PUBLIC_USE_NEW_EXPERIENCE=1' >> .env.local
npm run dev -- --port 3001
```

Open `http://localhost:3001` and tell it about a property.

**Run the tests** (no API key and no database needed):

```bash
cd backend && python -m pytest
```

Trouble getting started is covered in [Questions](#questions) below.

---

## Reference

<details>
<summary><b>Repository layout</b></summary>

```
tarini/
├── backend/
│   ├── server.py                 HTTP routes (7 of them)
│   ├── tarini/
│   │   ├── agent.py              Claude streaming loop and tool handling
│   │   ├── domain/               pure business rules, no framework imports
│   │   ├── application/          CommandService, TreeCommandService, codec
│   │   ├── ports/                repository and publish-gateway interfaces
│   │   ├── adapters/             Supabase, in-memory, stub publish
│   │   ├── prompts/              system prompts (markdown, versioned)
│   │   ├── flags.py              every environment switch, in one file
│   │   └── observability.py      Sentry, funnel stats
│   ├── db/migrations/            0001_baseline.sql, 0002_property_redesign.sql
│   └── tests/                    304 tests, including golden conversation flows
└── frontend/
    ├── app/components/blueprint/ the Living Blueprint panel
    ├── app/components/stages/    intro, structure, mapping, packages, verification
    └── design/prototypes/        design-system.html, the visual contract
```

</details>

<details>
<summary><b>Environment variables</b></summary>

**Backend**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | | Claude API key |
| `SUPABASE_URL` | production | | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | production | | Supabase service role key |
| `ALLOW_IN_MEMORY_DB` | dev only | `false` | skip Supabase locally |
| `USE_NEW_EXPERIENCE` | | `false` | redesigned backend (v2 tools, CommandService) |
| `USE_TREE_MODEL` | | `false` | recursive space tree, needs `USE_NEW_EXPERIENCE` |
| `ENABLE_UI_COMPONENTS` | | `true` | set `0` for plain-text chat, no generated UI |
| `MODEL_NAME` | | `claude-sonnet-4-20250514` | override the model |
| `TARINI_API_KEY` | | | bearer token for API auth |
| `SENTRY_DSN` | | | error tracking, unset means disabled |

**Frontend**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | backend base URL |
| `NEXT_PUBLIC_USE_NEW_EXPERIENCE` | new UI shell and Living Blueprint panel |
| `TARINI_API_KEY` | sent to the backend as `Authorization: Bearer` |
| `NEXT_PUBLIC_SENTRY_DSN` | browser error tracking |

</details>

<details>
<summary><b>Feature flags and rollback</b></summary>

Every flag defaults off, and the older code path keeps running until a flag is explicitly turned on.

```
USE_NEW_EXPERIENCE=1              redesigned backend
USE_TREE_MODEL=1                  recursive space tree
NEXT_PUBLIC_USE_NEW_EXPERIENCE=1  new UI shell
```

To roll back: unset `USE_NEW_EXPERIENCE` on Render. The old path resumes immediately, with no deploy.

</details>

<details>
<summary><b>Deployment and database</b></summary>

Backend deploys to Render on push to `main` (`render.yaml`). Frontend deploys to Vercel on push to `main`. Railway config is also present (`railway.json`) if Render is ever swapped out.

Migrations apply in order, in the Supabase SQL editor:

```
backend/db/migrations/0001_baseline.sql
backend/db/migrations/0002_property_redesign.sql   (needed for USE_NEW_EXPERIENCE)
```

</details>

<details>
<summary><b>Stack</b></summary>

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 16.1, React 19.2, Tailwind CSS 4 | Vercel |
| Backend | Python 3.12, FastAPI, uvicorn | Render |
| Model | Anthropic SDK, `claude-sonnet-4-20250514` | Anthropic API |
| Database | Supabase Postgres, JSONB snapshots | Supabase |

</details>

---

## Questions

<details>
<summary><b>Is this actually usable by a real property owner, or is it a demo?</b></summary>

A real owner can complete a full onboarding in it today, in their own words, including changing their mind halfway. What they cannot do is have the finished listing land in RentOk, because that last step is stubbed. So: real product behaviour, one missing pipe.
</details>

<details>
<summary><b>What happens when the model says something wrong or invents a room?</b></summary>

It cannot write anything directly. Everything it wants to change is a typed command that the backend validates against the domain rules before applying, and rejects if it breaks an invariant. For components rendered into the chat, the backend builds the properties from real state rather than trusting anything the model wrote. The blast radius of a bad model turn is one bad sentence, not a corrupted listing.
</details>

<details>
<summary><b>Why Python on the backend when the rest of RentOk is Node?</b></summary>

It was the fastest path to a working agent loop, and the domain layer is deliberately plain code with no framework in it, so porting it is mechanical if that becomes the right call. Worth deciding consciously rather than by drift, and it is a fair thing to challenge.
</details>

<details>
<summary><b>How much would it cost to run for a pilot?</b></summary>

Seven dollars a month for Render Starter, which also removes the cold start. Vercel and Supabase sit inside free tiers at pilot volume. The real variable cost is Claude API usage per conversation, which has not been measured yet and should be before any wide rollout.
</details>

<details>
<summary><b>The live link is spinning and nothing is happening.</b></summary>

Render's free tier sleeps after 15 idle minutes and takes roughly 50 seconds to wake. Give it a minute on the first message.
</details>

<details>
<summary><b>Local setup failed. What is the usual cause?</b></summary>

Nearly always one of three things: `ALLOW_IN_MEMORY_DB=true` not set, so it is trying to reach Supabase; `USE_NEW_EXPERIENCE=1` not set, so you are looking at the older path; or the frontend pointing at the wrong port. The test suite needs none of this and is the quickest way to confirm your Python setup works: `cd backend && python -m pytest`.
</details>

<details>
<summary><b>What would it take to ship this?</b></summary>

The RentOk publish contract, which unblocks the one stubbed adapter. Then real authentication, a measurement of per-conversation model cost, and a decision on the Python question above. The architecture work is done; what remains is integration and the operational basics.
</details>
