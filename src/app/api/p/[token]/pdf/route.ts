import { caseForToken } from "@/lib/family-link";
import { hit } from "@/lib/ratelimit";
import { bad } from "@/lib/api";
import { config } from "@/lib/config";
import { draftMark, planPdfResponse } from "@/lib/pdf-plan";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The family's PDF: their released plan, rendered on request. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await caseForToken(token);
  if (!c) return bad("This link is not valid any more.", undefined, 404);
  if (!(await hit(`pdf:${c.linkId}`, 30, 3600))) return bad("Too many downloads. Please try again later.", undefined, 429);
  log("plan.pdf", { reference: c.reference, kind: "family" });
  return planPdfResponse(c.releasedPlan, {
    reference: c.reference, issuedOn: c.releasedAt ?? new Date(), requestHref: `${config.appUrl()}/p/${token}#help`,
    watermark: draftMark(c.releasedPlan), filename: `Ageing-Navigator-Action-Plan-${c.reference}.pdf`,
  });
}
