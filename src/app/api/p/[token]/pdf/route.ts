import { hit } from "@/lib/ratelimit";
import { bad } from "@/lib/api";
import { draftMark, planPdfResponse } from "@/lib/pdf-plan";
import { familyRoute } from "@/lib/route";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The family's PDF: their released plan, rendered on request. It carries no link, so forwarding it opens nothing. */
export const GET = familyRoute(async (_req, c) => {
  if (!(await hit(`pdf:${c.linkId}`, 30, 3600))) return bad("Too many downloads. Please try again later.", undefined, 429);
  log("plan.pdf", { reference: c.reference, kind: "family" });
  return planPdfResponse(c.releasedPlan, {
    reference: c.reference, issuedOn: c.releasedAt ?? new Date(),
    watermark: draftMark(c.releasedPlan), filename: `Ageing-Navigator-Action-Plan-${c.reference}.pdf`,
  });
});
