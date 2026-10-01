import type { Metadata } from "next";
import { Download } from "lucide-react";
import { FamilyShell } from "@/components/FamilyShell";
import { caseForToken } from "@/lib/family-link";
import { content } from "@/lib/pilot/library";
import { PLAN_CSS, renderPlanSections } from "@/lib/pilot/render";
import { nzLongDate } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { RequestForm } from "./RequestForm";
import { FeedbackForm } from "./FeedbackForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Family Ageing Action Plan", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The family's private page: their released plan, the PDF, a way to ask for help, and the pilot feedback questions. */
export default async function PlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await caseForToken(token);
  if (!c) {
    return (
      <FamilyShell>
        <div className="card mx-auto max-w-xl p-6 sm:p-8">
          <h1 className="text-[24px]">This link is not valid any more</h1>
          <p className="mt-3 text-muted">Plan links stop working when a newer link has been sent, or when the plan has been deleted. If you need your plan again, contact {BRAND.name} on {BRAND.phone} or {BRAND.email}.</p>
        </div>
      </FamilyShell>
    );
  }
  const plan = c.releasedPlan;
  return (
    <FamilyShell>
      <div className="mx-auto max-w-3xl">
        {plan.contentStatus === "draft" && <p className="mb-4 rounded-lg bg-soon-soft p-3 text-[13.5px] text-soon"><strong>Test version.</strong> This plan uses draft wording that Ageing Navigator has not yet approved.</p>}
        <p className="eyebrow">{BRAND.planTitle}</p>
        <h1 className="mt-2 text-[clamp(1.7rem,4vw,2.4rem)] leading-tight">For {plan.personName}</h1>
        <p className="mt-2 text-[14px] text-muted">Prepared for {plan.preparedFor} · {c.releasedAt ? nzLongDate(c.releasedAt) : ""} · Reference {c.reference}</p>
        <a href={`/api/p/${token}/pdf`} className="btn-primary mt-5 !min-h-[44px]"><Download size={16} aria-hidden="true" />Download the plan as a PDF</a>

        <style>{PLAN_CSS(".anplan")}</style>
        <div className="anplan mt-8 text-[15.5px]" dangerouslySetInnerHTML={{ __html: renderPlanSections(plan, { mode: "web", requestHref: "#help" }) }} />

        <section id="help" className="card mt-10 scroll-mt-6 p-5 sm:p-7">
          <h2 className="text-[22px]">Ask for help with this plan</h2>
          <p className="mt-2 text-[15px]">{plan.cta}</p>
          <p className="mt-2 text-[14px] text-muted">{content.texts.request_intro}</p>
          <RequestForm token={token} services={plan.services} doneText={content.texts.request_done} />
        </section>

        <section className="card mt-6 p-5 sm:p-7">
          <h2 className="text-[20px]">Was this plan useful?</h2>
          {content.texts.feedback_intro && <p className="mt-2 text-[14px] text-muted">{content.texts.feedback_intro}</p>}
          <FeedbackForm token={token} given={!!c.feedback} />
        </section>
      </div>
    </FamilyShell>
  );
}
