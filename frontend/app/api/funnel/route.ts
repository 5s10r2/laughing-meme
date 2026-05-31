import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Wait out a Render free-tier cold start rather than timing out the proxy function.
export const maxDuration = 60;

/**
 * Proxy for the read-only onboarding funnel.
 * GET /api/funnel?token=… → backend GET /admin/funnel?token=… (gated by FUNNEL_TOKEN).
 * Forwards the backend status (401/404) so the dashboard can show the right state.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/admin/funnel?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Backend unavailable." }, { status: 502 });
  }
  const body = await res.json().catch(() => ({ error: "Funnel unavailable." }));
  return Response.json(body, { status: res.status });
}
