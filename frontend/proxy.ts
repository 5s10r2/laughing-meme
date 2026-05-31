import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dev-only routes are made unreachable in production at the edge, rather than
 * throwing notFound() inside a client render. They remain available in development.
 *
 *   /blueprint      — Living Blueprint component storybook
 *   /massing-spike  — MassingModel FSM playground
 *   /showcase       — Legacy component catalog
 *   /design-preview — Design iteration canvas
 *
 * Next 16 `proxy` convention (the renamed `middleware`).
 */
const DEV_ONLY_PREFIXES = ["/blueprint", "/massing-spike", "/showcase", "/design-preview"];

export function proxy(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const { pathname } = req.nextUrl;
    if (DEV_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return new NextResponse(null, { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/blueprint/:path*", "/blueprint",
    "/massing-spike/:path*", "/massing-spike",
    "/showcase/:path*", "/showcase",
    "/design-preview/:path*", "/design-preview",
  ],
};
