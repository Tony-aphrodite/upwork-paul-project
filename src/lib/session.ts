import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";
import { activeNavigator, type Navigator } from "./navigators";
import { noStore } from "./api";

/** The signed-in navigator for a server component, or null. */
export async function currentNavigator(): Promise<Navigator | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? activeNavigator(session.id, session.issuedAt) : null;
}

/** For every admin page: the navigator, or off to sign in. Pages check themselves; the layout alone is not enough. */
export async function requireNavigator(): Promise<Navigator> {
  const nav = await currentNavigator();
  if (!nav) redirect("/login");
  return nav;
}

function cookieFrom(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== name) continue;
    try { return decodeURIComponent(v.join("=")); } catch { return undefined; }
  }
  return undefined;
}

/** A browser sends Origin with every request that changes something; it must be this site. */
function sameSite(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host); } catch { return false; }
}

/** For admin API routes: the navigator, or a 401/403 response to return as is. */
export async function navigatorOr401(req: Request): Promise<Navigator | NextResponse> {
  if (!sameSite(req)) return NextResponse.json({ error: "Not allowed from another site" }, { status: 403, headers: noStore });
  const session = await verifySession(cookieFrom(req, SESSION_COOKIE));
  const nav = session ? await activeNavigator(session.id, session.issuedAt) : null;
  return nav ?? NextResponse.json({ error: "Sign in required" }, { status: 401, headers: noStore });
}
