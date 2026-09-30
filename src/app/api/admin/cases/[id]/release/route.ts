import { z } from "zod";
import { release } from "@/lib/cases";
import { hashToken, newToken } from "@/lib/secrets";
import { emailFamilyLink, familyLink } from "@/lib/release";
import { ok, parse } from "@/lib/api";
import { caseRoute } from "@/lib/route";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Approve and release: the working plan becomes the family's plan, a new private link replaces any earlier one and is
 * emailed. The link is returned once, so the navigator can copy it if the email fails; it is never stored in clear.
 */
export const POST = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, z.object({ version: z.number().int().positive() }), 4096);
  if ("error" in parsed) return parsed.error;
  const token = newToken();
  const { version, retainUntil } = await release(c.id, parsed.data.version, hashToken(token), nav.id);
  const emailSent = await emailFamilyLink(c, token, retainUntil);
  log("case.released", { reference: c.reference, ok: emailSent });
  return ok({ version, link: familyLink(token), emailSent, expires: retainUntil.toISOString() });
});
