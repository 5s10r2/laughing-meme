// Edge Runtime: no function timeout — required for SSE streams that can last 30-60 seconds.
// fetch() and ReadableStream are natively supported in the Edge Runtime.
export const runtime = "edge";

import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function sseError(message: string, status = 200) {
  return new Response(
    `data: ${JSON.stringify({ type: "error", message })}\n\n`,
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: typeof message === "string" ? message : "",
        initial,
      }),
    });
  } catch {
    return sseError("Backend unavailable.");
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
