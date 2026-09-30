import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";
import { activeNavigator, type Navigator } from "./navigators";
import { noStore } from "./api";

/** The signed-in navigator for a server component, or null. */
export async function currentNavigator(): Promise<Navigator | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? activeNavigator(session.id) : null;
}

function cookieFrom(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** For admin API routes: the navigator, or a 401 response to return as is. */
export async function navigatorOr401(req: Request): Promise<Navigator | NextResponse> {
  const session = await verifySession(cookieFrom(req, SESSION_COOKIE));
  const nav = session ? await activeNavigator(session.id) : null;
  return nav ?? NextResponse.json({ error: "Sign in required" }, { status: 401, headers: noStore });
}
