import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dev-only routes (the Living Blueprint storybook + the massing spike) are made
 * unreachable in production at the edge, rather than throwing notFound() inside a
 * client render. They remain available in development.
 *
 * Next 16 `proxy` convention (the renamed `middleware`).
 */
const DEV_ONLY_PREFIXES = ["/blueprint", "/massing-spike"];

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
  matcher: ["/blueprint/:path*", "/massing-spike/:path*", "/blueprint", "/massing-spike"],
};
