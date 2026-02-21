// Edge Runtime: no function timeout — required for SSE streams that can last 30-60 seconds.
// fetch() and ReadableStream are natively supported in the Edge Runtime.
export const runtime = "edge";

import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const { session_id, message } = await request.json();

  const res = await fetch(`${BACKEND_URL}/sessions/${session_id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message ?? "" }),
  });

  if (!res.ok || !res.body) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Backend unavailable" })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
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
