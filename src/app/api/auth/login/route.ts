import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_HOURS, adminPassword, createSession, safeEqual } from "@/lib/auth";
import { log } from "@/lib/log";

const attempts = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 8) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, adminPassword())) {
    attempts.set(ip, [...recent, now]);
    log("auth.failed");
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_HOURS * 3600 });
  log("auth.signed_in");
  return res;
}
