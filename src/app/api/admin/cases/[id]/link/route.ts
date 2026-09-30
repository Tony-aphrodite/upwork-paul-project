import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { Conflict, getCase, replaceLink, setReleaseEmailStatus } from "@/lib/cases";
import { releaseEmail, sendEmail } from "@/lib/email";
import { content } from "@/lib/pilot/library";
import { hashToken, newToken } from "@/lib/secrets";
import { config } from "@/lib/config";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

/** A fresh link for a released plan (the old one stops working), optionally emailed again. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, z.object({ send: z.boolean() }), 4096);
  if ("error" in parsed) return parsed.error;
  const c = await getCase(id);
  if (!c) return bad("Case not found.", undefined, 404);
  const token = newToken();
  try {
    const expires = await replaceLink(id, hashToken(token), nav.id);
    const link = `${config.appUrl()}/p/${token}`;
    let emailSent: boolean | undefined;
    if (parsed.data.send) {
      emailSent = await sendEmail(releaseEmail(content.texts, c.contactEmail, link, expires));
      await setReleaseEmailStatus(id, emailSent ? "sent" : "failed");
    }
    return ok({ link, emailSent, expires: expires.toISOString() });
  } catch (e) {
    if (e instanceof Conflict) return bad(e.message, undefined, 409);
    throw e;
  }
}
