// Edge Runtime: no function timeout — required for SSE streams that can last 30-60 seconds.
// fetch() and ReadableStream are natively supported in the Edge Runtime.
export const runtime = "edge";

import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.TARINI_API_KEY;

function backendHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

function sseError(message: string, status = 200, code?: string) {
  return new Response(
    `data: ${JSON.stringify({ type: "error", message, ...(code ? { code } : {}) })}\n\n`,
    {
      status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sseError("Invalid chat request.", 400);
  }

  const { session_id, message } = (body || {}) as {
    session_id?: unknown;
    message?: unknown;
    initial?: unknown;
  };
  const initial = (body as { initial?: unknown } | null)?.initial === true;

  if (typeof session_id !== "string" || !session_id.trim()) {
    return sseError("Missing session ID.", 400);
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/sessions/${encodeURIComponent(session_id)}/chat`, {
      method: "POST",
      headers: backendHeaders(),
      body: JSON.stringify({
        message: typeof message === "string" ? message : "",
        initial,
      }),
    });
  } catch {
    return sseError("Backend unavailable.");
  }

  if (res.status === 401 || res.status === 403) {
    return sseError("Authentication failed — the server API key is misconfigured.");
  }
  // Session gone (e.g. backend restarted / TTL-evicted) — tell the client to recreate it
  // rather than mislabelling it as an outage.
  if (res.status === 404) {
    return sseError("Session expired — starting a fresh one.", 200, "session_not_found");
  }
  if (!res.ok || !res.body) {
    return sseError("Backend unavailable.");
  }

  // Proxy the SSE stream straight through
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
