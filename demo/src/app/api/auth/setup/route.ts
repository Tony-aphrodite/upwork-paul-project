import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth";
import { completeSetup } from "@/lib/navigators";
import { hit } from "@/lib/ratelimit";
import { clientIp, pseudonym } from "@/lib/secrets";
import { bad, parse } from "@/lib/api";
import { publicRoute } from "@/lib/route";
import { MIN_PASSWORD } from "@/lib/validate";

export const runtime = "nodejs";

const Input = z.object({ token: z.string().max(100), password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`).max(200) });

/** A navigator chooses their password from the one-time setup link, and is signed in. */
export const POST = publicRoute(async (req) => {
  const parsed = await parse(req, Input, 4096);
  if ("error" in parsed) return parsed.error;
  if (!(await hit(`setup:${pseudonym(clientIp(req))}`, 10, 900))) return bad("Too many attempts. Try again in 15 minutes.", undefined, 429);
  const nav = await completeSetup(parsed.data.token, parsed.data.password);
  if (!nav) return bad("This setup link has expired or was already used. Ask for a new one.", undefined, 404);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(nav), sessionCookieOptions);
  return res;
});
