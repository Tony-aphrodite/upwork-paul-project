import { draftMark, planPdfResponse } from "@/lib/pdf-plan";
import { bad } from "@/lib/api";
import { caseRoute } from "@/lib/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The navigator's preview PDF of the working plan, or of the released plan with ?which=released. */
export const GET = caseRoute(async (req, _nav, c) => {
  const released = new URL(req.url).searchParams.get("which") === "released";
  const plan = released ? c.releasedPlan : c.workingPlan;
  if (!plan) return bad("This plan has not been released.", undefined, 404);
  return planPdfResponse(plan, {
    reference: c.reference, issuedOn: (released ? c.releasedAt : null) ?? new Date(),
    watermark: released ? draftMark(plan) : "Preview", filename: `${c.reference}-${released ? "released" : "preview"}.pdf`,
  });
});
