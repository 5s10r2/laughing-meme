"""
Tarini FastAPI server — SSE streaming chat API.

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
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

from claude_agent_sdk import AssistantMessage, ResultMessage, TextBlock

from tarini.db import client as db
from tarini.prompts import INITIAL_PROMPT
from tarini.session_manager import session_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — clean up on shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tarini server starting up")
    await db.init_client()
    session_manager.start_eviction_task()
    yield
    logger.info("Tarini server shutting down — cleaning up sessions")
    await session_manager.cleanup()
    await db.close_client()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Tarini API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field("", max_length=8000)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/sessions", status_code=201)
async def create_session():
    """Create a new onboarding session. Returns the session_id for subsequent calls."""
    session = await db.create_session()
    return {"session_id": session["id"]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get current session state — useful for the frontend to restore UI."""
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
    """
    Send a message to Tarini and stream the response via SSE.

    If message is empty, Tarini is asked to check state and give an opening greeting.
    This is how the frontend triggers the initial greeting on new sessions.
    """
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Empty message → trigger opening greeting
    user_message = (body.message or "").strip()
    if not user_message:
        user_message = INITIAL_PROMPT

    async def generate():
        # Send an immediate SSE comment — establishes the stream before any proxy timeout fires.
        # Cloudflare / Render close idle SSE connections after ~10 s with no data.
        yield ": connected\n\n"

        # Acquire the per-session query lock — prevents concurrent queries on same client
        async with session_manager.query_lock(session_id):
            try:
                # Re-fetch session inside the lock so sdk_session_id check is always current
                current_session = await db.get_session(session_id)
                if not current_session:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                    return

                # Connect to Claude CLI in the background; yield keepalives every 5 s so
                # the proxy does not time out during the CLI cold-start (can take 20-40 s).
                connect_task = asyncio.create_task(
                    session_manager.get_or_create_client(session_id)
                )
                while not connect_task.done():
                    done, _ = await asyncio.wait({connect_task}, timeout=5.0)
                    if not done:
                        yield ": keepalive\n\n"

                client = connect_task.result()  # re-raises on exception

                await client.query(user_message)

                captured_sdk_id: str | None = None

                async for msg in client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, TextBlock) and block.text:
                                yield f"data: {json.dumps({'type': 'text', 'text': block.text}, ensure_ascii=False)}\n\n"
                    elif isinstance(msg, ResultMessage):
                        captured_sdk_id = msg.session_id

                # Persist sdk_session_id on first successful exchange
                # Use current_session (fetched inside the lock) — not the outer snapshot
                # which could be stale if sdk_session_id was just set by a concurrent request.
                if captured_sdk_id and not current_session.get("sdk_session_id"):
                    await db.update_sdk_session_id(session_id, captured_sdk_id)
                    logger.info(
                        "Saved sdk_session_id %s for session %s",
                        captured_sdk_id,
                        session_id,
                    )

                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as exc:
                logger.exception("Error in chat stream for session %s", session_id)
                # Remove the broken client so next request creates a fresh one
                await session_manager.remove_client(session_id)
                yield f"data: {json.dumps({'type': 'error', 'message': 'An error occurred. Please try again.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for SSE
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/diag")
async def diag():
    """Diagnostic endpoint to verify the Claude CLI binary on this host."""
    import asyncio
    import platform
    import shutil
    import stat
    import sys
    from pathlib import Path

    import claude_agent_sdk

    bundled = Path(claude_agent_sdk.__file__).parent / "_bundled" / "claude"
    which_claude = shutil.which("claude")

    info: dict = {
        "python": sys.version,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "bundled_path": str(bundled),
        "bundled_exists": bundled.exists(),
        "bundled_executable": os.access(str(bundled), os.X_OK) if bundled.exists() else False,
        "which_claude": which_claude,
        "HOME": os.environ.get("HOME"),
        "ANTHROPIC_API_KEY_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }

    if bundled.exists():
        m = bundled.stat().st_mode
        info["bundled_mode"] = oct(m)

    # Try running the bundled binary
    if bundled.exists():
        try:
            proc = await asyncio.create_subprocess_exec(
                str(bundled), "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5)
            info["bundled_run_returncode"] = proc.returncode
            info["bundled_run_stdout"] = stdout.decode(errors="replace")[:500]
            info["bundled_run_stderr"] = stderr.decode(errors="replace")[:500]
        except asyncio.TimeoutError:
            info["bundled_run_error"] = "timeout"
        except Exception as e:
            info["bundled_run_error"] = str(e)

    return info
