import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth";
import { checkLogin } from "@/lib/navigators";
import { blocked, clear, hit } from "@/lib/ratelimit";
import { clientIp, pseudonym } from "@/lib/secrets";
import { bad, parse } from "@/lib/api";
import { publicRoute } from "@/lib/route";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const Input = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });
const WINDOW = 900;

/**
 * Sign in with email and password. Only failures count, in three limits: per connection, per account from that
 * connection (the tight one), and per account overall (high, so a stranger cannot lock a navigator out easily).
 */
export const POST = publicRoute(async (req) => {
  const parsed = await parse(req, Input, 4096);
  if ("error" in parsed) return parsed.error;
  const { email, password } = parsed.data;
  const ip = pseudonym(clientIp(req)), acct = pseudonym(email.toLowerCase());
  const keys: [string, number][] = [[`login:ip:${ip}`, 30], [`login:acct-ip:${acct}:${ip}`, 8], [`login:acct:${acct}`, 50]];
  for (const [key, limit] of keys) if (await blocked(key, limit, WINDOW)) return bad("Too many attempts. Try again in 15 minutes.", undefined, 429);
  const nav = await checkLogin(email, password);
  if (!nav) {
    for (const [key] of keys) await hit(key, Number.MAX_SAFE_INTEGER, WINDOW);
    log("auth.failed");
    return bad("That email and password do not match.", undefined, 401);
  }
  await clear(keys[1][0]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(nav), sessionCookieOptions);
  log("auth.signed_in");
  return res;
});
