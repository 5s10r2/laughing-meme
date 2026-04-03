# Testing Patterns

**Analysis Date:** 2026-04-03

## Test Framework

**Status:** No testing framework configured or in use.

**Frontend:**
- No test runner (Jest, Vitest, or similar) installed or configured
- No test configuration files (jest.config.js, vitest.config.js, etc.)
- 0 test files found in project (`*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx`)

**Backend:**
- No testing framework installed (pytest, unittest not in `requirements.txt`)
- 0 test files in `backend/tarini/` directory
- `requirements.txt` contains only runtime dependencies (anthropic, supabase, fastapi, uvicorn, python-dotenv, pydantic)

**Assertion Library:** Not applicable (no tests)

**Run Commands:**
```bash
# Frontend
npm run lint              # Only linting, no test runner

# Backend
# No test command available
```

## Test Organization

**Current State:**
- No test directories (e.g., `__tests__`, `tests/`, `spec/`) exist
- No test fixtures or factories
- No test utilities or helpers

**Expected Structure (if added):**
- Frontend: Co-locate tests alongside components (e.g., `Button.test.tsx` next to `Button.tsx`)
- Backend: Separate `tests/` directory with structure mirroring `tarini/` (e.g., `tests/tarini/tools/test_state.py`)

## Test Coverage

**Requirements:** None enforced
**Coverage percentage:** 0% (no tests)
**View coverage:** Not applicable

## What is NOT Tested

### Frontend Coverage Gaps

**Components (40 total, 0% tested):**
- Chat components: `ChatUI.tsx`, `ChatInput.tsx`, `MessageBubble.tsx`, `MessagePartRenderer.tsx`, `ChatHeader.tsx` — core chat streaming, SSE parsing, message rendering
- UI components: `BottomSheet.tsx`, `DataConfirmationCard.tsx`, `ErrorRecoveryCard.tsx`, `QuickReplyChips.tsx` — modal behavior, event handling
- Stage components (all 28):
  - Intro: `PropertyTypeSelector.tsx`, `IntroSummaryCard.tsx`, `WelcomeHero.tsx`
  - Structure: `FloorBuilder.tsx`, `UnitCountInput.tsx`, `NamingPreview.tsx`, `FloorMilestoneReceipt.tsx`, `StructureSummaryCard.tsx`
  - Packages: `PackageForm.tsx`, `PackageList.tsx`, `PackageSuggestionCard.tsx`, `PackageReceipt.tsx`
  - Mapping: `MappingMatrix.tsx`, `FloorMappingRow.tsx`, `MappingSuggestionCard.tsx`, `BulkMappingPreview.tsx`, `UnmappedUnitsWarning.tsx`
  - Verification: `VerificationSummary.tsx`, `PendingItemsList.tsx`, `CompletionCelebration.tsx`
- Context: `OnboardingStateContext.tsx` — state updates, hook behavior
- Utilities: `component-registry.tsx`, `sse-parser.ts`, `cn.ts`, `types.ts`

**Risk Areas:**
- SSE parsing logic (`lib/sse-parser.ts`) — handles event coalescing, component validation, state snapshots
- Component registry fallback (`component-registry.tsx`) — unknown component handling
- ChatUI state machine (`ChatUI.tsx`) — session init, message accumulation, abort handling
- Form validation (`PackageForm.tsx`, `UnitCountInput.tsx`) — required field checks, type conversions

**Current Testing Method:** Manual testing in browser only

### Backend Coverage Gaps

**Core Logic (9 modules, 0% tested):**
- Agent streaming (`tarini/agent.py`): Tool use loop, history trimming, token tracking, event generation
- State tools (`tarini/tools/state.py`): Deep merge logic, state validation, stage transitions
- Session manager (`tarini/session_manager.py`): History cache, idle eviction, persistence on "done"
- Database client (`tarini/db/client.py`): Supabase fallback logic, in-memory store, atomic state updates
- UI validation (`tarini/tools/ui.py`): Component props validation
- FastAPI server (`server.py`): SSE streaming, keepalive logic, request handling
- Session lifecycle (`main.py`): CLI session management (dev tool only)

**Risk Areas:**
- Tool execution loop safety (`agent.py`): MAX_TOOL_ROUNDS limit, exception handling in tool dispatch
- Sliding window history (`agent.py`): _trim_history_for_api() trimming correctness, message loss on boundary
- Deep merge behavior (`state.py`): Recursive dict merging, list overwrite semantics
- Supabase fallback (`db/client.py`): In-memory state integrity under concurrent sessions
- Idle session eviction (`session_manager.py`): Timing correctness, memory cleanup
- SSE keepalive (`server.py`): Timeout handling, queue overflow under slow clients

**Current Testing Method:** Manual CLI testing with `.tarini_session` file

## Test Types

**Unit Tests (if added):**
- Scope: Individual functions in isolation
- Approach: Mock external dependencies (Anthropic API, Supabase, fetch)
- Frontend examples: `cn()` utility, `formatFieldLabel()`, event handlers
- Backend examples: `_deep_merge()`, `_get_previous_stage()`, state validators

**Integration Tests (if added):**
- Scope: Multi-component workflows (full agent turn, session persistence)
- Approach: Use real Supabase (or test instance) and mock Anthropic API
- Frontend: Chat flow from user input → SSE parsing → UI render
- Backend: Session creation → chat turn → message persistence → cache reload

**E2E Tests (if added):**
- Framework: Playwright or similar (not currently installed)
- Scope: Full user flows (property onboarding, stage transitions)
- Approach: Run against deployed backend, real Anthropic API with fixtures

**Manual Testing:**
- **Frontend:** Browser testing with dev backend running on `localhost`
- **Backend:** CLI via `python main.py` (creates/resumes sessions in `.tarini_session`)
- **API:** Raw curl/Postman testing of SSE endpoints

## Defensive Patterns in Lieu of Tests

Since no formal tests exist, code includes defensive practices to catch bugs at runtime:

**Frontend:**
- Props validation in components: `PackageForm.tsx` tries multiple prop name variants before defaulting
- Type guards: `Array.isArray()`, `typeof` checks before operations
- Graceful fallbacks: Component registry returns `null` for unknown components instead of crashing
- Error boundaries: SSE parsing wrapped in try/catch
- Example: `DataConfirmationCard` handles both array and object `fields` format

**Backend:**
- Async exception handling: Tool execution wrapped in try/catch with logging
- Type hints throughout: Pydantic models for requests, type annotations on functions
- Validation at boundaries: `validate_emit_ui()` checks component + props before emission
- Logging for observability: All state changes and tool calls logged with session ID for debugging
- Fallback mechanisms: Supabase unreachable → in-memory store, maintains consistency
- Example: `db/client.py` detects Supabase unavailable and switches to in-memory within 5s timeout

## Recommendations for Testing

### High-Priority Unit Tests

**Frontend (quick wins):**
1. `lib/sse-parser.ts`: Text coalescing, event parsing, error handling
2. `lib/cn.ts`: Conditional class merging
3. `components/ui/DataConfirmationCard.tsx`: Label formatting, field normalization

**Backend (safety):**
1. `tarini/tools/state.py`: `_deep_merge()` with edge cases (nested dicts, list replacement, circular refs)
2. `tarini/tools/state.py`: Stage validation, state version incrementing
3. `tarini/db/client.py`: In-memory store behavior under concurrent operations

### High-Priority Integration Tests

**Frontend:**
1. Full chat flow: Message send → SSE stream → UI update
2. Component emission and interaction
3. Session persistence across page reload

**Backend:**
1. Tool execution loop with multiple turns
2. Session persistence: Create → chat → evict → reload
3. Error recovery: Supabase unavailable fallback

### Test Setup Recommendations

**Frontend:**
- Install Vitest (lighter than Jest for React 19)
- Use `@testing-library/react` for component testing
- Mock fetch and SSE with `whatwg-fetch` polyfill if needed
- Test files co-located with components

**Backend:**
- Install pytest with `pytest-asyncio` for async support
- Use pytest fixtures for session/database setup
- Mock `anthropic.AsyncAnthropic` for agent tests
- Mock Supabase in fallback tests

---

*Testing analysis: 2026-04-03*
