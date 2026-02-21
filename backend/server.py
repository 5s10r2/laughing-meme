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
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

from tarini.db import client as db
from tarini.prompts import INITIAL_PROMPT
from tarini.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tarini server starting up")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field("", max_length=8000)


# ---------------------------------------------------------------------------
# SSE keepalive helper
# ---------------------------------------------------------------------------

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
            await queue.put({"type": "error", "message": "An error occurred. Please try again."})
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
            get_task.cancel()
            try:
                await get_task
            except (asyncio.CancelledError, Exception):
                pass
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/sessions", status_code=201)
async def create_session():
    session = await db.create_session()
    return {"session_id": session["id"]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
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
async def chat(session_id: str, body: ChatRequest):
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_message = (body.message or "").strip() or INITIAL_PROMPT

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
    return {"status": "ok"}
