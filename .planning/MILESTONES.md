# Milestones

## v1.0 — Core Onboarding Flow

**Shipped:** 2026-02-27
**Phases:** 1-5 (inferred from git history)

**What shipped:**
- Full 5-stage conversational onboarding (intro → structure → packages → mapping → verification)
- 28 generative UI components with emit_ui tool
- SSE streaming with keepalive bridge pattern
- Conversation persistence across server restarts
- Sliding window for API cost control
- Deployed: Vercel (frontend) + Render free tier (backend)

**Key commits:**
- `ce6e7a1` — Replace Claude Agent SDK with direct Anthropic API
- `1609c6a` — Persist conversation history to Supabase
- `58dd17a` — Generative UI: 28 components + SSE protocol extension
- `4999cfc` — Showcase page rendering all 25 registered components
