import { z } from "zod";
import { replaceLink } from "@/lib/cases";
import { hashToken, newToken } from "@/lib/secrets";
import { emailFamilyLink, familyLink } from "@/lib/release";
import { ok, parse } from "@/lib/api";
import { caseRoute } from "@/lib/route";

export const runtime = "nodejs";

/** A fresh link for a released plan (the old one stops working), emailed to the family or only shown to copy. */
export const POST = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, z.object({ send: z.boolean() }), 4096);
  if ("error" in parsed) return parsed.error;
  const token = newToken();
  const expires = await replaceLink(c.id, hashToken(token), nav.id);
  const emailSent = parsed.data.send ? await emailFamilyLink(c, token, expires) : undefined;
  return ok({ link: familyLink(token), emailSent, expires: expires.toISOString() });
});
