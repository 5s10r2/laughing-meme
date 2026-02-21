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
# SSE queue-drain helper
# ---------------------------------------------------------------------------

async def _drain_queue_with_keepalives(
    queue: "asyncio.Queue[dict | None]",
    keepalive_interval: float = 2.0,
):
    """
    Async generator that drains `queue` and yields SSE lines.

    Strategy: use asyncio.wait (NOT asyncio.wait_for) so the queue.get()
    future is REUSED across keepalive iterations without ever being cancelled.

    asyncio.wait_for() cancels the wrapped coroutine on every timeout, which
    causes subtle CancelledError propagation issues in Python 3.12+ inside
    async generators driven by uvicorn's ASGI machinery.
    asyncio.wait() simply checks whether the future is done — no cancellation.
    """
    get_task: asyncio.Task = asyncio.ensure_future(queue.get())
    try:
        while True:
            logger.debug("[drain] calling asyncio.wait, timeout=%.1f", keepalive_interval)
            done, _ = await asyncio.wait({get_task}, timeout=keepalive_interval)

            if not done:
                # Timeout — no item yet.  Send a keepalive and loop.
                logger.debug("[drain] timeout — yielding keepalive")
                yield f"data: {json.dumps({'type': 'thinking'})}\n\n"
                continue

            # The future is done — retrieve the result.
            item = get_task.result()
            logger.debug("[drain] got item: %s", item)

            if item is None:
                # Sentinel — stream is finished.
                logger.debug("[drain] received sentinel, stopping")
                break

            event_str = json.dumps(item, ensure_ascii=False)
            yield f"data: {event_str}\n\n"

            if item.get("type") in ("done", "error"):
                break

            # Queue up a new get() for the next item.
            get_task = asyncio.ensure_future(queue.get())

    finally:
        # Cancel any outstanding get() so it doesn't leak.
        if not get_task.done():
            get_task.cancel()
            try:
                await get_task
            except (asyncio.CancelledError, Exception):
                pass


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
        """
        SSE generator using a Queue bridge so that:
          1. The chat logic runs in a background asyncio.Task (no timeout issues).
          2. _drain_queue_with_keepalives() sends keepalives every 2 s while waiting.
             It uses asyncio.wait (not asyncio.wait_for) to avoid CancelledError
             propagation bugs in Python 3.12+ inside async generators.
          3. A None sentinel signals end-of-stream.
        """
        # Immediate keepalive so the proxy sees data before its idle timer fires.
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def _run_chat() -> None:
            """Full chat logic in a background task — puts events into the queue."""
            logger.info("[_run_chat] STARTED for session %s", session_id)
            try:
                logger.info("[_run_chat] acquiring query_lock for session %s", session_id)
                async with session_manager.query_lock(session_id):
                    logger.info("[_run_chat] lock acquired for session %s", session_id)
                    try:
                        current_session = await db.get_session(session_id)
                        if not current_session:
                            await queue.put({"type": "error", "message": "Session not found"})
                            return

                        logger.info("[_run_chat] calling get_or_create_client for session %s", session_id)
                        client = await session_manager.get_or_create_client(session_id)
                        logger.info("[_run_chat] got client, sending query for session %s", session_id)

                        await client.query(user_message)
                        logger.info("[_run_chat] query sent, reading response for session %s", session_id)

                        captured_sdk_id: str | None = None

                        async for msg in client.receive_response():
                            if isinstance(msg, AssistantMessage):
                                for block in msg.content:
                                    if isinstance(block, TextBlock) and block.text:
                                        await queue.put({"type": "text", "text": block.text})
                            elif isinstance(msg, ResultMessage):
                                captured_sdk_id = msg.session_id

                        logger.info("[_run_chat] response complete for session %s", session_id)

                        if captured_sdk_id and not current_session.get("sdk_session_id"):
                            await db.update_sdk_session_id(session_id, captured_sdk_id)
                            logger.info("Saved sdk_session_id %s for session %s", captured_sdk_id, session_id)

                        await queue.put({"type": "done"})

                    except Exception:
                        logger.exception("[_run_chat] ERROR in chat task for session %s", session_id)
                        await session_manager.remove_client(session_id)
                        await queue.put({"type": "error", "message": "An error occurred. Please try again."})
                    finally:
                        logger.info("[_run_chat] putting sentinel for session %s", session_id)
                        await queue.put(None)  # sentinel — always signals end
            except Exception:
                logger.exception("[_run_chat] OUTER ERROR for session %s (lock acquisition failed?)", session_id)
                await queue.put({"type": "error", "message": "Failed to start chat. Please try again."})
                await queue.put(None)

        task = asyncio.create_task(_run_chat())
        logger.info("[generate] background task created for session %s", session_id)
        try:
            async for sse_line in _drain_queue_with_keepalives(queue):
                yield sse_line
        finally:
            logger.info("[generate] generator finishing, cancelling task for session %s", session_id)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

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


@app.get("/sse-test")
async def sse_test():
    """Test SSE keepalive behavior on this host (simple asyncio.sleep pattern)."""
    async def gen():
        for i in range(15):
            yield f"data: {json.dumps({'tick': i, 't': i*2})}\n\n"
            await asyncio.sleep(2)
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/queue-test")
async def queue_test():
    """
    Test SSE using asyncio.Queue + asyncio.wait pattern (no Claude SDK).
    Background task sleeps 20 seconds then puts text/done in queue.
    If this works but /chat fails, the issue is Claude SDK specific.
    If this also fails, the issue is the asyncio Queue pattern on this Python version.
    """
    async def gen():
        # Immediate keepalive
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        async def _mock_task():
            logger.info("[queue-test] mock task started, sleeping 20s")
            await asyncio.sleep(20)
            logger.info("[queue-test] mock task awake, putting events")
            await queue.put({"type": "text", "text": "Hello from the queue test! The asyncio.wait pattern works."})
            await queue.put({"type": "done"})
            await queue.put(None)
            logger.info("[queue-test] mock task done")

        task = asyncio.create_task(_mock_task())
        try:
            async for sse_line in _drain_queue_with_keepalives(queue):
                yield sse_line
        finally:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/diag")
async def diag():
    """Diagnostic endpoint to verify the Claude CLI binary on this host."""
    import platform
    import shutil
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
