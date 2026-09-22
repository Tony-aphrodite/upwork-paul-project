import { z } from "zod";
import { ActionPlan, FamilyProfile } from "@/lib/schema";
import { renderPlanHtml, renderSummaryHtml } from "@/doc/templates";
import { INLINE_FONTS } from "@/doc/fonts-inline";
import { htmlToPdf, pageCount } from "@/doc/pdf";
import { bad, body, issues, noStore } from "@/lib/api";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60;

const Input = z.object({ kind: z.enum(["plan", "summary"]), plan: ActionPlan, profile: FamilyProfile });

/**
 * Structured plan in, PDF out. The PDF is streamed straight back and never written to disk or cached, so no copy of
 * a family's document is left on the server. In production a signed, expiring link to encrypted storage replaces this.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await body(req, 1024 * 1024); } catch { return bad("Send a JSON body under 1 MB.", undefined, 400); }
  const input = Input.safeParse(raw);
  if (!input.success) return bad("The document data is not valid.", issues(input.error));
  const { kind, plan, profile } = input.data;
  if (plan.profileId !== profile.profileId) return bad("The plan and the profile do not belong together.");
  const t = Date.now();
  const html = (kind === "plan" ? renderPlanHtml : renderSummaryHtml)(plan, profile, { fonts: { kind: "inline", files: INLINE_FONTS } });
  const pdf = await htmlToPdf(html);
  log("document.rendered", { planId: plan.planId, version: plan.version, kind, pages: pageCount(pdf), bytes: pdf.length, ms: Date.now() - t });
  const file = `${plan.planId}-v${plan.version}-${kind === "plan" ? "family-action-plan" : "professional-summary"}.pdf`;
  return new Response(Buffer.from(pdf), { headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"`, "X-Pages": String(pageCount(pdf)) } });
}
