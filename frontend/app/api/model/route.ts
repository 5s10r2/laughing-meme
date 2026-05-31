import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.TARINI_API_KEY;

/**
 * Proxy for the live read-model endpoint backing the Blueprint panel.
 * GET /api/model?session_id=… → backend GET /sessions/:id/model
 * Returns { model, completeness, version, blueprint } (no LLM).
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return Response.json({ error: "Missing session ID." }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/sessions/${encodeURIComponent(sessionId)}/model`, { headers });
  } catch {
    return Response.json({ error: "Backend unavailable." }, { status: 502 });
  }

  if (!res.ok) {
    return Response.json({ error: "Model unavailable." }, { status: res.status });
  }
  return Response.json(await res.json());
}
