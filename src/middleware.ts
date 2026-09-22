import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/** Everything under /admin and /api needs a session, except signing in. Family data never reaches an unauthenticated request. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Signing in and the JSON Schemas (no family data) are public.
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/schemas/")) return NextResponse.next();
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
