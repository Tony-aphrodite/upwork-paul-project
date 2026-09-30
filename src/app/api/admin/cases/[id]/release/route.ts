import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { Conflict, getCase, release, setReleaseEmailStatus } from "@/lib/cases";
import { releaseEmail, sendEmail } from "@/lib/email";
import { content } from "@/lib/pilot/library";
import { hashToken, newToken } from "@/lib/secrets";
import { config } from "@/lib/config";
import { bad, ok, parse } from "@/lib/api";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Approve and release: the working plan becomes the family's plan, a new private link is made and emailed.
 * The link is returned once, so the navigator can copy it if the email fails; it is never stored in clear.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, z.object({ version: z.number().int().positive() }), 4096);
  if ("error" in parsed) return parsed.error;
  const c = await getCase(id);
  if (!c) return bad("Case not found.", undefined, 404);
  const token = newToken();
  try {
    const { version, retainUntil } = await release(id, parsed.data.version, hashToken(token), nav.id);
    const link = `${config.appUrl()}/p/${token}`;
    const sent = await sendEmail(releaseEmail(content.texts, c.contactEmail, link, retainUntil));
    await setReleaseEmailStatus(id, sent ? "sent" : "failed");
    log("case.released", { reference: c.reference, ok: sent });
    return ok({ version: version, link, emailSent: sent, expires: retainUntil.toISOString() });
  } catch (e) {
    if (e instanceof Conflict) return bad(e.message, undefined, 409);
    throw e;
  }
}
