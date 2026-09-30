import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth";
import { checkLogin } from "@/lib/navigators";
import { clear, hit } from "@/lib/ratelimit";
import { clientIp, pseudonym } from "@/lib/secrets";
import { bad, parse } from "@/lib/api";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const Input = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

/** Sign in with email and password. Guessing is limited per connection and per account, in the database. */
export async function POST(req: Request) {
  const parsed = await parse(req, Input, 4096);
  if ("error" in parsed) return parsed.error;
  const { email, password } = parsed.data;
  const ipKey = `login:ip:${pseudonym(clientIp(req))}`;
  const accountKey = `login:acct:${pseudonym(email.toLowerCase())}`;
  const allowed = (await hit(ipKey, 20, 900)) && (await hit(accountKey, 8, 900));
  if (!allowed) return bad("Too many attempts. Try again in 15 minutes.", undefined, 429);
  const nav = await checkLogin(email, password);
  if (!nav) {
    log("auth.failed");
    return bad("That email and password do not match.", undefined, 401);
  }
  await clear(accountKey);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(nav), sessionCookieOptions);
  log("auth.signed_in");
  return res;
}
