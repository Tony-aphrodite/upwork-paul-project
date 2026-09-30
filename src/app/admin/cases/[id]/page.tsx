import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCase, listRequests, markOpened } from "@/lib/cases";
import { currentNavigator } from "@/lib/session";
import { content } from "@/lib/pilot/library";
import { isAnswered, labelsFor, visibleSections } from "@/lib/questionnaire/logic";
import { CaseEditor, type CaseView } from "./CaseEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Case" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const nav = await currentNavigator();
  if (!nav) redirect("/login");
  const { id } = await params;
  let c = await getCase(id);
  if (!c) notFound();
  if (c.status === "submitted") { await markOpened(id, nav.id); c = (await getCase(id))!; }
  const requests = await listRequests(id);

  const answers = visibleSections(content.questionnaire, c.answers).map((s) => ({
    title: s.title,
    items: s.questions.filter((q) => isAnswered(c.answers[q.id])).map((q) => ({ q: q.label, a: labelsFor(q, c.answers[q.id]) })),
  })).filter((s) => s.items.length);

  const view: CaseView = {
    id: c.id, reference: c.reference, status: c.status, version: c.version, urgent: c.urgent,
    submittedAt: c.submittedAt.toISOString(), releasedAt: c.releasedAt?.toISOString() ?? null, retainUntil: c.retainUntil.toISOString(),
    contentVersion: c.contentVersion, currentContentVersion: content.version,
    contact: { name: c.contactName, email: c.contactEmail, phone: c.contactPhone ?? "" },
    personName: c.personPreferredName || c.personFirstName, referral: c.referral, marketingConsent: c.marketingConsent,
    releaseEmailStatus: c.releaseEmailStatus, plan: c.workingPlan, hasReleased: !!c.releasedPlan,
    releasedDiffers: !!c.releasedPlan && JSON.stringify(c.releasedPlan) !== JSON.stringify(c.workingPlan),
    note: c.navigatorNote, answers,
    requests: requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    feedback: c.feedback, feedbackAt: c.feedbackAt?.toISOString() ?? null,
    serviceLabels: Object.fromEntries(content.services.map((s) => [s.id, s.label])),
  };
  return <CaseEditor data={view} />;
}
