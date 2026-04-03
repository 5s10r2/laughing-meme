# Codebase Structure

**Analysis Date:** 2026-04-03

## Directory Layout

```
tarini-agent/
├── backend/
│   ├── server.py                      # FastAPI app + 3 HTTP endpoints
│   ├── main.py                        # CLI entry point (local testing)
│   ├── requirements.txt                # Python dependencies
│   ├── tarini/
│   │   ├── __init__.py
│   │   ├── agent.py                   # Core agent loop + stream_chat()
│   │   ├── session_manager.py         # In-memory session state + eviction
│   │   ├── prompts/
│   │   │   ├── __init__.py            # INITIAL_PROMPT + load_system_prompt()
│   │   │   └── system_prompt.md       # Claude system prompt
│   │   ├── tools/
│   │   │   ├── __init__.py            # Tool dispatcher + TOOL_DEFINITIONS
│   │   │   ├── state.py               # get_state, update_state, advance_stage tools
│   │   │   └── ui.py                  # emit_ui tool + component validation
│   │   └── db/
│   │       ├── __init__.py
│   │       └── client.py              # Supabase async wrapper + in-memory fallback
│   └── __pycache__/
│
├── frontend/
│   ├── package.json                   # Next.js + React + Tailwind
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── app/
│   │   ├── page.tsx                   # Root page (renders ChatUI)
│   │   ├── layout.tsx                 # Root layout + OnboardingStateProvider
│   │   ├── globals.css                # Tailwind + custom styles
│   │   ├── api/
│   │   │   ├── session/route.ts       # POST /api/session (create session)
│   │   │   └── chat/route.ts          # POST /api/chat (SSE proxy)
│   │   ├── context/
│   │   │   └── OnboardingStateContext.tsx  # React context for stage + state
│   │   ├── components/
│   │   │   ├── ChatUI.tsx             # Main chat interface component
│   │   │   ├── chat/
│   │   │   │   ├── ChatHeader.tsx     # Header with stage progress bar
│   │   │   │   ├── ChatInput.tsx      # Text input + send button
│   │   │   │   ├── MessageBubble.tsx  # Message container + part renderer
│   │   │   │   └── MessagePartRenderer.tsx  # Renders individual message parts
│   │   │   ├── ui/
│   │   │   │   ├── StageProgressBar.tsx
│   │   │   │   ├── StageTransitionCard.tsx
│   │   │   │   ├── ToolActivityIndicator.tsx
│   │   │   │   ├── QuickReplyChips.tsx
│   │   │   │   ├── DataConfirmationCard.tsx
│   │   │   │   ├── ErrorRecoveryCard.tsx
│   │   │   │   ├── CollapsibleSection.tsx
│   │   │   │   ├── BottomSheet.tsx
│   │   │   │   └── FloorChipBar.tsx
│   │   │   └── stages/
│   │   │       ├── intro/
│   │   │       │   ├── WelcomeHero.tsx
│   │   │       │   ├── PropertyTypeSelector.tsx
│   │   │       │   └── IntroSummaryCard.tsx
│   │   │       ├── structure/
│   │   │       │   ├── FloorBuilder.tsx
│   │   │       │   ├── UnitCountInput.tsx
│   │   │       │   ├── NamingPreview.tsx
│   │   │       │   ├── FloorMilestoneReceipt.tsx
│   │   │       │   └── StructureSummaryCard.tsx
│   │   │       ├── packages/
│   │   │       │   ├── PackageSuggestionCard.tsx
│   │   │       │   ├── PackageForm.tsx
│   │   │       │   ├── PackageReceipt.tsx
│   │   │       │   └── PackageList.tsx
│   │   │       ├── mapping/
│   │   │       │   ├── MappingSuggestionCard.tsx
│   │   │       │   ├── FloorMappingRow.tsx
│   │   │       │   ├── MappingMatrix.tsx
│   │   │       │   ├── BulkMappingPreview.tsx
│   │   │       │   └── UnmappedUnitsWarning.tsx
│   │   │       └── verification/
│   │   │           ├── VerificationSummary.tsx
│   │   │           ├── PendingItemsList.tsx
│   │   │           └── CompletionCelebration.tsx
│   │   ├── lib/
│   │   │   ├── types.ts               # Core types (Message, SSEEvent, Stage, etc.)
│   │   │   ├── sse-parser.ts          # Async generator parsing SSE stream
│   │   │   ├── component-registry.tsx # Component name → React component mapping
│   │   │   ├── render-markdown.tsx    # Inline markdown rendering helper
│   │   │   ├── property-utils.ts      # Property data manipulation utilities
│   │   │   └── cn.ts                  # clsx wrapper for className merging
│   │   ├── showcase/
│   │   │   └── page.tsx               # Demo page for component showcase
│   │   └── public/
│   │       └── favicon.ico
│   ├── node_modules/
│   ├── .next/
│   └── .vercel/
│
├── .planning/
│   └── codebase/
│       └── ARCHITECTURE.md
│
├── .claude/                           # User-specific Claude preferences
├── documentation.md
├── memory.md
└── .gitignore
```

## Directory Purposes

**`backend/`:**
- Purpose: FastAPI server, agent orchestration, tool execution, session management
- Contains: Python source code, requirements, entry points
- Key files: `server.py` (entry point), `agent.py` (inference loop), `session_manager.py` (state container)

**`backend/tarini/`:**
- Purpose: Core Tarini agent package
- Contains: Agent, session management, tools, database client, system prompt
- Organization: Modular by concern (agent, session, tools, db, prompts)

**`backend/tarini/tools/`:**
- Purpose: Tool implementations callable by Claude during inference
- Contains: `get_state`, `update_state`, `advance_stage`, `emit_ui` handlers
- Dispatch: `execute_tool()` in `__init__.py` routes by tool_name

**`backend/tarini/db/`:**
- Purpose: Persistence layer abstraction
- Contains: Async Supabase wrapper + in-memory fallback for local dev
- Pattern: Graceful degradation — tests pass offline using memory store

**`frontend/app/`:**
- Purpose: Next.js App Router structure
- Contains: Pages, API routes, components, context, utilities
- Organization: Logical by feature (chat, stages) + shared (ui, lib)

**`frontend/app/api/`:**
- Purpose: Next.js edge runtime API routes for backend proxying
- Contains: `session/route.ts` (POST /api/session), `chat/route.ts` (POST /api/chat)
- Pattern: Edge runtime (no 10-second timeout) for Render free-tier compatibility

**`frontend/app/components/`:**
- Purpose: All React components for chat and onboarding UI
- Organization:
  - `chat/`: Message display + input (core chat interface)
  - `ui/`: Reusable UI building blocks (cards, indicators, chips)
  - `stages/`: Stage-specific components organized by onboarding stage

**`frontend/app/components/stages/`:**
- Purpose: Interactive forms + visualizations for each onboarding stage
- Organization: intro/ structure/ packages/ mapping/ verification/ (one dir per stage)
- Components: Forms for data entry, cards for suggestions/summaries, visual builders

**`frontend/app/context/`:**
- Purpose: React context providers for global state
- Contains: OnboardingStateContext for stage + property data
- Pattern: useOnboardingState() hook throughout components

**`frontend/app/lib/`:**
- Purpose: Utilities and type definitions
- Key files:
  - `types.ts`: Core type definitions (Message, SSEEvent, Stage, OnboardingState)
  - `component-registry.tsx`: Dynamic component rendering by name
  - `sse-parser.ts`: Async SSE event stream parser
  - `render-markdown.tsx`: Inline markdown support in text
  - `property-utils.ts`: Helpers for property data manipulation

## Key File Locations

**Entry Points:**

- **Frontend root:** `frontend/app/page.tsx` → renders `ChatUI`
- **Frontend layout:** `frontend/app/layout.tsx` → wraps app in OnboardingStateProvider
- **Backend root:** `backend/server.py` → FastAPI app definition + route handlers
- **Backend CLI:** `backend/main.py` → local development/testing entry point
- **Agent loop:** `backend/tarini/agent.py` → `stream_chat(session_id, user_message, history)` function

**Configuration:**

- **Frontend config:** `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/tailwind.config.ts`
- **Backend deps:** `backend/requirements.txt`
- **Backend env:** `.env` file (not tracked; contains ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY)
- **Frontend env:** Frontend reads BACKEND_URL in route handlers via `process.env.BACKEND_URL`

**Core Logic:**

- **Agent:** `backend/tarini/agent.py` — `stream_chat()` implements tool-use loop
- **Session state:** `backend/tarini/session_manager.py` — SessionManager singleton
- **Session persistence:** `backend/tarini/db/client.py` — async Supabase + fallback
- **Tools:** `backend/tarini/tools/state.py` (get/update state), `backend/tarini/tools/ui.py` (emit_ui)
- **Chat UI:** `frontend/app/components/ChatUI.tsx` — main component, SSE event processing
- **Message rendering:** `frontend/app/components/chat/MessagePartRenderer.tsx` — dispatches to component registry

**Testing/Development:**

- **Component showcase:** `frontend/app/showcase/page.tsx` — demo page
- **CLI testing:** `backend/main.py` — local conversation testing without browser

## Naming Conventions

**Backend (Python):**

- **Files:** snake_case (e.g., `session_manager.py`, `state.py`)
- **Functions:** snake_case (e.g., `stream_chat()`, `execute_tool()`)
- **Classes:** PascalCase (e.g., `SessionManager`)
- **Constants:** UPPER_CASE (e.g., `_IDLE_TTL_SECONDS`, `MODEL`)
- **Private:** Leading underscore (e.g., `_trim_history_for_api()`)

**Frontend (TypeScript/React):**

- **Files:**
  - Components: PascalCase (e.g., `ChatUI.tsx`, `FloorBuilder.tsx`)
  - Utilities: camelCase (e.g., `sse-parser.ts`, `component-registry.tsx`)
  - Types: Append .ts/.tsx (e.g., `types.ts`)
- **Functions:** camelCase (e.g., `parseSSEStream()`, `renderInlineMarkdown()`)
- **Components:** PascalCase (e.g., `function ChatUI()`)
- **Hooks:** camelCase with `use` prefix (e.g., `useOnboardingState()`)
- **Directories:** lowercase (e.g., `stages/`, `chat/`, `ui/`)

## Where to Add New Code

**New Backend Tool:**
- Implement handler in `backend/tarini/tools/` (new file or add to existing)
- Add to TOOL_DEFINITIONS in `backend/tarini/tools/__init__.py`
- Add dispatch case in `execute_tool()` function
- Example: `backend/tarini/tools/state.py` shows pattern (pure async function returning JSON string)

**New Frontend Component:**
- Create in appropriate subdirectory under `frontend/app/components/stages/` or `frontend/app/components/ui/`
- File naming: PascalCase matching export name (e.g., `MyComponent.tsx`)
- Export default function or named export
- Accept `props` + optional `onSendMessage` callback
- Add to COMPONENT_REGISTRY in `frontend/app/lib/component-registry.tsx`
- Example: `frontend/app/components/stages/intro/PropertyTypeSelector.tsx`

**New Stage-Specific UI:**
- Create new directory under `frontend/app/components/stages/{stage_name}/`
- Create components for forms, suggestions, summaries (one per file)
- Register all components in `frontend/app/lib/component-registry.tsx`
- Agent calls via emit_ui tool with component name + props

**New Backend Endpoint:**
- Add route in `backend/server.py` using @app.post() or @app.get() decorators
- Keep logic in separate modules (tarini/ package)
- Ensure proper error handling and logging

**New Utility:**
- Frontend: Add to appropriate file in `frontend/app/lib/` (create if new category)
- Backend: Add to tarini/ subpackage matching concern (tools/, db/, prompts/)

## Special Directories

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No (in .gitignore)

**`frontend/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (via npm install)
- Committed: No (in .gitignore)

**`backend/__pycache__/`:**
- Purpose: Python bytecode cache
- Generated: Yes
- Committed: No (in .gitignore)

**`.env` files:**
- Purpose: Environment configuration (API keys, Supabase URL, backend URL)
- Contains: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY (backend); BACKEND_URL (frontend)
- Committed: No — secrets never tracked
- Note: Backend falls back to in-memory store if Supabase env vars missing

**`.planning/`:**
- Purpose: GSD planning documents and codebase analysis
- Generated: By `/gsd:*` commands
- Committed: Yes

---

*Structure analysis: 2026-04-03*
