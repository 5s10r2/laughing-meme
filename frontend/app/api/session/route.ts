// Edge Runtime: no 10-second function timeout — needed when Render cold-starts (30-90s).
export const runtime = "edge";

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.TARINI_API_KEY;

function backendHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

export async function POST() {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/sessions`, {
      method: "POST",
      headers: backendHeaders(),
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unreachable — server may be starting up" },
      { status: 503 }
    );
  }

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json(
      { error: "Authentication failed — the server API key is misconfigured." },
      { status: 401 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { status: 201 });
}
