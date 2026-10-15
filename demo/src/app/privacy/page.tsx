import type { Metadata } from "next";
import { FamilyShell } from "@/components/FamilyShell";
import { loadPolicy } from "@/lib/pilot/privacy";
import { fmtDate } from "@/lib/text";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Privacy Policy" };

/** The privacy policy, linked from the consent on the questionnaire's first page and from every family page's footer. */
export default function PrivacyPage() {
  const policy = loadPolicy();
  return (
    <FamilyShell>
      <article className="card mx-auto max-w-3xl p-6 sm:p-8">
        {policy.status === "draft" && <p className="mb-5 rounded-lg bg-soon-soft p-3 text-[18px] text-soon"><strong>Draft.</strong> This policy is waiting for Ageing Navigator&rsquo;s approval.</p>}
        <h1 className="text-[clamp(1.9rem,4.4vw,2.7rem)] leading-tight">{policy.title}</h1>
        <p className="mt-2 text-[18px] text-muted">Last updated {fmtDate(policy.updated)}</p>
        <div className="policy mt-6" dangerouslySetInnerHTML={{ __html: policy.html }} />
      </article>
    </FamilyShell>
  );
}
