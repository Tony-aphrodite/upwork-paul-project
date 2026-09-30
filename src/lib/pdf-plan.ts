import { INLINE_FONTS } from "@/doc/fonts-inline";
import { htmlToPdf } from "@/doc/pdf";
import { renderPlanDocument } from "@/lib/pilot/render";
import type { PilotPlan } from "@/lib/pilot/plan";
import { noStore } from "@/lib/api";

/** Render a plan to a PDF response. Nothing is written to disk; the PDF is made for this request only. */
export async function planPdfResponse(plan: PilotPlan, opts: { reference: string; issuedOn: Date; requestHref?: string; watermark?: string; filename: string }) {
  const html = renderPlanDocument(plan, { fonts: { kind: "inline", files: INLINE_FONTS }, ...opts });
  const pdf = await htmlToPdf(html);
  return new Response(Buffer.from(pdf), {
    headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${opts.filename}"` },
  });
}

/** Released plans built on content that is not yet approved carry a visible mark, so they are never mistaken for real. */
export const draftMark = (plan: PilotPlan) => (plan.contentStatus === "draft" ? "Draft content" : undefined);
