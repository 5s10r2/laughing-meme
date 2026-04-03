# Technology Stack

**Analysis Date:** 2026-04-03

## Languages

**Primary:**
- TypeScript 5 - Frontend (React/Next.js)
- Python 3.12.0 - Backend (FastAPI)

**Secondary:**
- JavaScript - Build tools, configuration

## Runtime

**Environment:**
- Python 3.12.0 (`backend/runtime.txt`)
- Node.js (via Next.js) - Frontend

**Package Manager:**
- npm - Frontend (Lock file: `frontend/package-lock.json`)
- pip - Backend (Lock file: `backend/requirements.txt`)

## Frameworks

**Core:**
- Next.js 16.1.6 - React SSR framework for frontend (`frontend/app/`)
- React 19.2.3 - Frontend UI library
- React DOM 19.2.3 - React rendering
- FastAPI 0.115.14 - Python backend HTTP framework (`backend/server.py`)
- Uvicorn 0.29.0 - ASGI server for FastAPI

**UI/Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- Tailwind Merge 3.5.0 - Merge conflicting CSS classes
- class-variance-authority 0.7.1 - Component variant patterns
- clsx 2.1.1 - Conditional CSS class construction
- Lucide React 0.575.0 - Icon library

**Animation:**
- Framer Motion 12.34.3 - React animation library

**Testing:**
- Not configured (no test runner detected in dependencies)

**Build/Dev:**
- TypeScript 5 - Type checking and compilation
- ESLint 9 - JavaScript/TypeScript linting
- ESLint Next.js config 16.1.6 - Next.js specific rules
- Tailwind PostCSS 4 - PostCSS plugin for Tailwind

## Key Dependencies

**Critical:**
- anthropic >= 0.42.0 - Anthropic API SDK for Claude AI integration (`backend/tarini/agent.py`)
- supabase 2.28.0 - PostgreSQL database client (`backend/tarini/db/client.py`)
- fastapi 0.115.14 - Web framework for backend API (`backend/server.py`)
- uvicorn[standard] 0.29.0 - Production ASGI server

**Infrastructure:**
- pydantic 2.12.5 - Data validation and settings management (`backend/server.py`)
- python-dotenv 1.0.1 - Environment variable loading (`backend/server.py`, `backend/main.py`)

## Configuration

**Environment:**
- Backend: `.env` file (required: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) — See `backend/.env.example`
- Frontend: `.env.local` file (required: `BACKEND_URL`) — See `frontend/.env.local.example`
- Configuration loaded via `python-dotenv` in backend, `process.env` in frontend

**Build:**
- Frontend: `frontend/next.config.ts` - Minimal Next.js config
- Frontend: `frontend/tsconfig.json` - TypeScript strict mode enabled
- Backend: `backend/render.yaml` - Render.com deployment config
- Backend: `backend/railway.json` - Railway.app deployment config
- Backend: `backend/Procfile` - Heroku process file

**Type Configuration:**
- Frontend TypeScript: Target ES2017, strict mode, path alias `@/*` maps to `frontend/`

## Platform Requirements

**Development:**
- Python 3.12.0
- Node.js (LTS recommended)
- npm or yarn
- Environment variables for Anthropic API key and Supabase credentials

**Production:**
- Render.com or Railway.app for backend hosting (Python/FastAPI)
- Vercel for frontend hosting (Next.js) — `.vercel/project.json` configured
- Supabase PostgreSQL database (managed)
- Anthropic API account with valid API key

## Deployment Architecture

**Backend:**
- Deployed to Render.com or Railway.app
- Startup command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Health check: `/health` endpoint
- Environment: Variables synced from platform dashboard

**Frontend:**
- Deployed to Vercel (Next.js native hosting)
- Communicates with backend via `BACKEND_URL` environment variable
- Edge Runtime used for SSE streaming endpoints (`frontend/app/api/chat/route.ts`, `frontend/app/api/session/route.ts`)

---

*Stack analysis: 2026-04-03*
