"""
Tarini FastAPI server — SSE streaming chat API.

Uses direct Anthropic API calls (no CLI subprocess).

Endpoints:
  POST /sessions              → create a new session
  GET  /sessions/{id}         → get session state
  POST /sessions/{id}/chat    → send a message, stream Tarini's response (SSE)

SSE event format:
  data: {"type": "text",  "text": "..."}
  data: {"type": "done"}
  data: {"type": "error", "message": "..."}
"""
import asyncio
import json
import logging
import os
import re
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

load_dotenv(override=True)

from tarini.agent import _use_new_experience, opening_prompt
from tarini.db import client as db
from tarini.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Tarini server starting up (experience=%s)",
        "new" if _use_new_experience() else "legacy",
    )
    await db.init_client()
    session_manager.start_eviction_task()
    yield
    logger.info("Tarini server shutting down")
    await session_manager.cleanup()
    await db.close_client()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Tarini API", version="2.0.0", lifespan=lifespan)

# Explicit origin list — never use ["*"] with allow_credentials=True (violates CORS spec).
# In production all browser traffic flows through the Next.js proxy routes
# (server-to-server, no Origin header, so CORS never applies). This middleware
# only matters for direct browser access during local dev / debugging.
# Auth is a Bearer token, not a cookie, so allow_credentials stays False
# (credentials=True with a wildcard would be invalid, and we have no cookies to send).
_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

_API_KEY = os.environ.get("TARINI_API_KEY", "").strip()
_bearer = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> None:
    """Validate Bearer token when TARINI_API_KEY is set. No-op in dev (key unset)."""
    if not _API_KEY:
        return  # dev mode — no key configured
    if not credentials or credentials.credentials != _API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

# Strip null bytes and other control chars (keep newlines, tabs)
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _sanitize(text: str) -> str:
    return _CONTROL_CHARS.sub("", text).strip()


class ChatRequest(BaseModel):
    message: str = Field("", max_length=8000)
    initial: bool = False


# ---------------------------------------------------------------------------
# SSE keepalive helper
# ---------------------------------------------------------------------------

async def _cancel_task(t: asyncio.Task) -> None:
    """Cancel a task and await it, swallowing the resulting exceptions."""
    t.cancel()
    await asyncio.gather(t, return_exceptions=True)


async def _stream_with_keepalives(
    session_id: str,
    user_message: str,
    keepalive_interval: float = 2.0,
):
    """
    Async generator that streams chat events with keepalives.

    Uses asyncio.Queue bridge so the chat logic runs in a background task
    while keepalives are sent during quiet periods (tool execution, API calls).
    """
    yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def _run_chat() -> None:
        try:
            async with session_manager.query_lock(session_id):
                async for event in session_manager.chat(session_id, user_message):
                    await queue.put(event)
        except Exception:
            logger.exception("[_run_chat] ERROR for session %s", session_id)
            session_manager.remove_session(session_id)
            await queue.put({
                "type": "error",
                "message": "Something went wrong — your session has been reset. Please start a new conversation.",
                "code": "CHAT_STREAM_ERROR",
            })
        finally:
            await queue.put(None)  # sentinel

    task = asyncio.create_task(_run_chat())

    # Drain queue with keepalives using asyncio.wait (not wait_for)
    get_task: asyncio.Task = asyncio.ensure_future(queue.get())
    try:
        while True:
            done, _ = await asyncio.wait({get_task}, timeout=keepalive_interval)

            if not done:
                yield f"data: {json.dumps({'type': 'thinking'})}\n\n"
                continue

            item = get_task.result()
            if item is None:
                break

            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

            if item.get("type") in ("done", "error"):
                break

            get_task = asyncio.ensure_future(queue.get())
    finally:
        if not get_task.done():
            await _cancel_task(get_task)
        await _cancel_task(task)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/sessions", status_code=201)
async def create_session(_: None = Depends(require_auth)):
    session = await db.create_session()
    return {"session_id": session["id"]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str, _: None = Depends(require_auth)):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session["id"],
        "stage": session.get("stage"),
        "state": session.get("state") or {},
        "state_version": session.get("state_version"),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
    }


@app.post("/sessions/{session_id}/chat")
async def chat(session_id: str, body: ChatRequest, _: None = Depends(require_auth)):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = opening_prompt() if body.initial else _sanitize(body.message or "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    return StreamingResponse(
        _stream_with_keepalives(session_id, user_message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    db_health = await db.health_check()
    status = "ok" if db_health["ok"] else "degraded"
    return {"status": status, "database": db_health}
