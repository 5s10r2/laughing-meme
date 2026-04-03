# Coding Conventions

**Analysis Date:** 2026-04-03

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `PropertyTypeSelector.tsx`, `ChatInput.tsx`, `PackageForm.tsx`)
- Utility files: camelCase (e.g., `cn.ts`, `types.ts`, `component-registry.tsx`)
- Python modules: snake_case (e.g., `session_manager.py`, `component_registry.py`)
- Types/interfaces: PascalCase with suffix (e.g., `ChatInputProps`, `OnboardingState`, `SSEEvent`)

**Functions:**
- React components: PascalCase (exported) or camelCase helpers (internal)
- Python functions: snake_case with underscore prefix for private helpers (e.g., `_deep_merge`, `_tool_description`, `_trim_history_for_api`)
- Helper functions used in JSDoc or logic: camelCase (e.g., `formatFieldLabel`, `handleSubmit`, `nextSharingType`)

**Variables:**
- State variables: camelCase (e.g., `packageName`, `sharingType`, `isStreaming`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_TOOL_ROUNDS`, `_IDLE_TTL_SECONDS`, `VALID_STAGES`)
- Props objects: camelCase (e.g., `onSendMessage`, `stateVersion`)
- Backend session/state keys: snake_case (e.g., `session_id`, `state_version`, `sharing_type`, `floor_index`)

**Types:**
- Interfaces ending in Props: `ComponentNameProps` (e.g., `ChatInputProps`, `BottomSheetProps`, `DataConfirmationCardProps`)
- Event types: `SSE{Event}Event` suffix (e.g., `SSETextEvent`, `SSEComponentEvent`, `SSEStateSnapshotEvent`)
- Union types: descriptive (e.g., `MessagePart`, `SSEEvent`, `OnboardingState`)

## Code Style

**Formatting:**
- Frontend: No explicit formatter configured (ESLint only)
- Backend: No formatter configured; uses Python conventions with 4-space indents
- Line length: Practical (no strict limit enforced)
- Tailwind classes: Inline using `cn()` utility for conditional styling

**Linting:**
- Frontend: ESLint with Next.js and TypeScript config (`eslint.config.mjs`)
  - Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
  - Key rules: Enforces Next.js best practices and TypeScript strict mode
  - Run: `npm run lint`
- Backend: No linter configured; relies on code review

## Import Organization

**Order (Frontend - React/TypeScript):**
1. External libraries (React, third-party packages)
2. Internal app imports (components, utilities, types, context)
3. CSS/style imports (if any)

**Examples:**
```typescript
// Order 1: External libraries
import { useState, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Order 2: Internal utilities and types
import type { Message } from "../../lib/types";
import { cn } from "../../lib/cn";
import { MessagePartRenderer } from "./MessagePartRenderer";

// Order 3: No explicit style imports (Tailwind + cn utility)
```

**Path Aliases:**
- Frontend: `@/*` maps to root of `/frontend` (configured in `tsconfig.json`)
- Used sparingly; most imports use relative paths

**Backend Import Order (Python):**
1. Standard library (asyncio, json, os, logging, etc.)
2. Third-party packages (anthropic, supabase, fastapi, pydantic)
3. Local imports (from tarini.* modules)

```python
import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI

from tarini.agent import build_options
from tarini.db import client as db
```

## Error Handling

**Frontend Patterns:**
- Try/catch for async operations (session creation, API calls)
- Error messages shown in UI components (`ErrorRecoveryCard`)
- Graceful degradation: fallback to null/empty state if component not found
- Console warnings for unregistered components: `console.warn('[component-registry] Unknown component...')`
- Network errors caught and displayed in message bubbles (e.g., "Sorry, I couldn't connect right now...")

**Backend Patterns:**
- Async exceptions caught in tool execution and SSE streaming loops
- Logging used for error tracking: `logger.exception()` for stack traces, `logger.warning()` for recoverable issues
- HTTP errors raised explicitly: `HTTPException(status_code=404, detail="...")` in FastAPI routes
- Tool validation errors returned as JSON strings: `{"error": "message"}`
- Graceful fallback: in-memory store used if Supabase unavailable; logs warning and continues
- Session cache misses logged and reloaded from DB: `logger.info("Cache miss for session %s...")`

## Logging

**Framework:** Python `logging` module (backend), `console` methods (frontend)

**Backend Patterns:**
- Configured in `server.py` with `logging.basicConfig(level=logging.INFO)`
- Named loggers per module: `logger = logging.getLogger(__name__)`
- Info logs: State updates, session lifecycle, tool execution: `logger.info("[function_name] message")`
- Warning logs: Fallback behaviors (Supabase unavailable), max tool rounds hit
- Exception logs: Errors with full traceback: `logger.exception("message")`
- Debug logs: Low-priority diagnostics (token usage parsing failures)
- Format: Includes function name in brackets for grep-ability: `[stream_chat] tokens session=%s...`

**Frontend:**
- Console logs used for component registry warnings: `console.warn('[component-registry] ...')`
- ESLint disables default `console` checks when intentional: `// eslint-disable-next-line react-hooks/exhaustive-deps`

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic (e.g., `_deep_merge` with recursive dict handling)
- Public API docstrings: Python functions use triple-quote docstrings explaining args/returns
- Architecture decisions: Section markers with dashes (e.g., `# ── Helpers ────`)
- Important caveats: Persistence behavior before yielding "done", sliding window history trimming
- Tool-specific behavior: emit_ui handling is special (no tool indicator shown)

**JSDoc/TSDoc:**
- Sparingly used in frontend; most functions are self-documenting
- Python docstrings used for public functions and complex helpers
- Section comments organize code into logical blocks (e.g., `# ── Tool description mapping ──`)

## Function Design

**Size:**
- Frontend: Component functions typically 50-100 lines for complex UI (PackageForm is 300 lines but includes substantial form state)
- Backend: Tool functions stay under 30 lines; agent functions under 150 lines with clear sections
- Helper functions: 10-20 lines for pure utility logic

**Parameters:**
- React components: Accept Props interface as single parameter, destructure in signature
- Python async functions: Session ID + context parameters as separate args
- Event handlers: Single event parameter or callback style for React

**Return Values:**
- Frontend components: React.ReactElement (implicit)
- Frontend utilities: Type-safe (e.g., `string`, `Record<string, unknown>`)
- Backend async functions: Return JSON-serializable dicts or JSON strings
- Tool handlers: Always return JSON string for API consistency

## Module Design

**Exports:**
- React components: Default export (allows `import { ComponentName }` with destructuring)
- Utilities: Named exports (e.g., `export function cn()`, `export function renderRegisteredComponent()`)
- Context: Both provider component and hook exported (e.g., `OnboardingStateProvider`, `useOnboardingState`)
- Python modules: Functions imported directly or module aliased (e.g., `from tarini.db import client as db`)

**Barrel Files:**
- Frontend: `lib/component-registry.tsx` centrally imports all 28 UI components
- Backend: `tools/__init__.py` exports TOOL_DEFINITIONS and execute_tool dispatcher
- Enables single-source registry for component/tool validation

**Defensive Props Handling:**
- Components normalize malformed props from backend
- Example in `PackageForm.tsx`: tries multiple prop name variants (camelCase, snake_case) with fallbacks
- Reduces tight coupling between frontend and Claude tool definitions

## Architecture Patterns

**Unidirectional Data Flow:**
- Frontend: `OnboardingStateContext` holds authoritative session state, updated only via `updateFromSnapshot()` from SSE events
- Backend: State is source-of-truth in Supabase; frontend mirrors it
- No bidirectional sync; state changes flow through explicit tool calls

**Tool-Driven UI:**
- Backend Claude agent emits components via `emit_ui` tool
- Frontend renders components dynamically via registry lookup
- Components send user interactions back as natural language messages (no special message format)

**SSE Event Streaming:**
- Backend uses asyncio queue + keepalives for reliable streaming
- Frontend parses SSE and coalesces text chunks into single message parts
- Tool execution, component renders, and state snapshots are separate event types

**Session Lifecycle:**
- Sessions created lazily (first connection)
- Persisted in Supabase with versioning
- Message history cached in memory, reloaded on cache miss
- Idle sessions evicted after 30 min (backend background task)

---

*Convention analysis: 2026-04-03*
