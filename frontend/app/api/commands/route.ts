import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.TARINI_API_KEY;

/**
 * Proxy for direct Blueprint edits.
 * POST /api/commands { session_id, commands, expected_version?, idempotency_key? }
 *   → backend POST /sessions/:id/commands (CommandService.apply, no LLM)
 * Forwards the backend status (notably 409 conflict) so the client can reconcile.
 */
export async function POST(request: NextRequest) {
  let body: {
    session_id?: unknown;
    commands?: unknown;
    expected_version?: unknown;
    idempotency_key?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const sessionId = body?.session_id;
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return Response.json({ error: "Missing session ID." }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/sessions/${encodeURIComponent(sessionId)}/commands`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commands: body.commands,
        expected_version: body.expected_version,
        idempotency_key: body.idempotency_key,
      }),
    });
  } catch {
    return Response.json({ error: "Backend unavailable." }, { status: 502 });
  }

  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
