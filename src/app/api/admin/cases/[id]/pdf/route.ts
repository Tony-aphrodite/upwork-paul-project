import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { getCase } from "@/lib/cases";
import { draftMark, planPdfResponse } from "@/lib/pdf-plan";
import { bad } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The navigator's preview PDF of the working plan, or of the released plan with ?which=released. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const c = await getCase(id);
  if (!c) return bad("Case not found.", undefined, 404);
  const released = new URL(req.url).searchParams.get("which") === "released";
  const plan = released ? c.releasedPlan : c.workingPlan;
  if (!plan) return bad("This plan has not been released.", undefined, 404);
  return planPdfResponse(plan, {
    reference: c.reference, issuedOn: (released ? c.releasedAt : null) ?? new Date(),
    watermark: released ? draftMark(plan) : "Preview", filename: `${c.reference}-${released ? "released" : "preview"}.pdf`,
  });
}
