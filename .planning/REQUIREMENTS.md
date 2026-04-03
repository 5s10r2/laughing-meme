# Requirements: Tarini Agent

**Defined:** 2026-04-03
**Core Value:** Accurate property data capture through conversational onboarding

## v1.1 Requirements

Requirements for backend hardening milestone. Each maps to roadmap phases.

### Cost Optimization

- [x] **COST-01**: System prompt uses Anthropic prompt caching (cache_control on system content block) to reduce input token costs by ~80%
- [x] **COST-02**: System prompt is cached at module load time, not read from disk on every chat turn

### Configuration

- [x] **CONF-01**: AI model name is configurable via environment variable (MODEL_NAME) with sensible default

### Reliability

- [x] **RELY-01**: History trimming maintains valid user/assistant message alternation when applying sliding window
- [x] **RELY-02**: Anthropic API stream calls have a timeout (60s) with clear error event on timeout
- [x] **RELY-03**: Anthropic client is a module-level singleton that reuses HTTP connection pool across chat turns

### Data Integrity

- [x] **DATA-01**: Stage advancement and state update happen atomically in a single database transaction
- [x] **DATA-02**: Tool error responses use proper JSON serialization (json.dumps) instead of f-string interpolation

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Product Gaps (v1.2)

- **PROD-01**: Gender preference field (male/female/co-ed) for PG listings
- **PROD-02**: Security deposit capture
- **PROD-03**: Lock-in / notice period capture

### Infrastructure (v1.3+)

- **INFRA-01**: Test coverage for session lifecycle, tool execution, SSE streaming
- **INFRA-02**: CORS whitelist (replace allow_origins=["*"])
- **INFRA-03**: API authentication for backend endpoints
- **INFRA-04**: Rate limiting per session/IP

## Out of Scope

| Feature | Reason |
|---------|--------|
| Frontend changes | Backend-only milestone — frontend SSE contract unchanged |
| New onboarding features | Deferred to v1.2 to keep scope tight |
| Test coverage | Separate milestone — large effort, different focus |
| Monitoring/logging overhaul | Not blocking; address when scaling |
| Photo capture | Major feature, requires storage infra — v1.2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COST-01 | Phase 6 | Complete |
| COST-02 | Phase 6 | Complete |
| CONF-01 | Phase 6 | Complete |
| RELY-01 | Phase 7 | Complete |
| RELY-02 | Phase 7 | Complete |
| RELY-03 | Phase 7 | Complete |
| DATA-01 | Phase 8 | Complete |
| DATA-02 | Phase 8 | Complete |

**Coverage:**
- v1.1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after initial definition*
