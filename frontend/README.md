# Tarini — Frontend

Next.js 16 (App Router) frontend for the Tarini property onboarding agent.

See the [root README](../README.md) for full setup instructions, environment variables, and architecture.

## Quick start

```bash
npm install
npm run dev -- --port 3001
```

## Key directories

```
app/
├── api/              # Proxy routes to the FastAPI backend
├── components/
│   ├── blueprint/    # Living Blueprint panel (MassingModel, FloorLedger, MappingRow, ...)
│   └── stages/       # Legacy stage-specific components
└── design/
    └── prototypes/
        └── design-system.html  # Canonical design contract — read before building new components
```

## Design system

`frontend/design/prototypes/design-system.html` is the canonical spec for all Blueprint components. Open it in a browser before building or modifying anything in `app/components/blueprint/`.
