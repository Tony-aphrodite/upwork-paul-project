import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCase, listRequests, markOpened } from "@/lib/cases";
import { requireNavigator } from "@/lib/session";
import { content } from "@/lib/pilot/library";
import { emailReady, skipsAddress } from "@/lib/email";
import { cleanAnswers, isAnswered, labelsFor, visibleSections } from "@/lib/questionnaire/logic";
import { CaseEditor, type CaseView } from "./CaseEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Case" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const nav = await requireNavigator();
  const { id } = await params;
  let c = await getCase(id);
  if (!c) notFound();
  if (c.status === "submitted") { await markOpened(id, nav.id); c = (await getCase(id))!; }
  const requests = await listRequests(id);

  // Shown through the current questionnaire; answers to questions that no longer exist are listed apart, not lost.
  const current = cleanAnswers(content.questionnaire, c.answers);
  const answers = visibleSections(content.questionnaire, current).map((s) => ({
    title: s.title,
    items: s.questions.filter((q) => isAnswered(current[q.id])).map((q) => ({ q: q.label, a: labelsFor(q, current[q.id]) })),
  })).filter((s) => s.items.length);
  const gone = Object.keys(c.answers).filter((k) => !(k in current));
  if (gone.length) answers.push({ title: "Answers to questions no longer asked", items: gone.map((k) => ({ q: k, a: [JSON.stringify(c.answers[k])] })) });

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
    emailReady: emailReady(),
    testAddress: skipsAddress(c.contactEmail),
  };
  return <CaseEditor data={view} />;
}
