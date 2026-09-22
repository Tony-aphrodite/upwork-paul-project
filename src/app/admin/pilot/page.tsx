"use client";

import Link from "next/link";
import clsx from "clsx";
import { CheckCircle2, ClipboardList, MessageSquare, Send, Undo2 } from "lucide-react";
import { PILOT_LABEL, PILOT_TARGET, useWorkspace, workspace, type PilotStatus, type PlanRecord } from "@/lib/workspace";
import { Card } from "@/components/ui";

const ORDER: PilotStatus[] = ["awaiting_review", "changes_needed", "approved", "sent", "draft"];
const TONE: Record<PilotStatus, string> = {
  awaiting_review: "bg-soon-soft text-soon", changes_needed: "bg-now-soft text-now",
  approved: "bg-ahead-soft text-ahead", sent: "bg-brand-soft text-brand", draft: "bg-line/60 text-muted",
};
const USEFUL: Record<string, string> = { very: "Very useful", somewhat: "Somewhat useful", not_really: "Not really useful" };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default function PilotPage() {
  const ws = useWorkspace();
  if (!ws) return <p className="text-muted">Loading…</p>;
  const plans = Object.values(ws.plans);
  const withPilot = plans.filter((p) => p.pilot).sort((a, b) => ORDER.indexOf(a.pilot!.status) - ORDER.indexOf(b.pilot!.status) || (b.pilot!.submittedAt ?? "").localeCompare(a.pilot!.submittedAt ?? ""));
  const sent = withPilot.filter((p) => p.pilot!.status === "sent").length;
  const feedback = withPilot.filter((p) => p.pilot!.feedback);
  const waiting = withPilot.filter((p) => p.pilot!.status === "awaiting_review").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Pilot</p>
        <h1 className="mt-1 text-[28px]">Fifty plans, then full build</h1>
        <p className="mt-1 max-w-3xl text-muted">Every plan a family submits through the questionnaire arrives here for a navigator to check before it is sent. The queue, the review note and the feedback are the evidence for whether the plans are useful.</p>
      </div>

      <section className="card p-5" aria-labelledby="prog-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="prog-h" className="text-[19px]">Progress to {PILOT_TARGET} plans</h2>
          <p className="text-[14px] text-muted">{sent} sent · {waiting} awaiting review · {feedback.length} with feedback</p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={sent} aria-valuemin={0} aria-valuemax={PILOT_TARGET} aria-label="Plans sent to families">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.min(100, (sent / PILOT_TARGET) * 100)}%` }} />
        </div>
        <p className="mt-2 text-[13px] text-muted">In this demo the queue lives in your browser, because the proof of concept has no database. In production a family&rsquo;s submission reaches this queue through the server, and each plan records which questionnaire version produced it.</p>
      </section>

      <section aria-labelledby="queue-h">
        <h2 id="queue-h" className="text-[19px]">Review queue</h2>
        {withPilot.length === 0 ? (
          <Card className="mt-3"><div className="p-6 text-muted"><ClipboardList size={20} className="mb-2 text-brand" aria-hidden="true" /><p>No plans yet. Open the <Link className="font-semibold text-brand underline" href="/questionnaire">family questionnaire</Link> in another tab and submit one, or load a test case from the workspace.</p></div></Card>
        ) : (
          <ul className="mt-3 space-y-3">{withPilot.map((rec) => <QueueRow key={rec.planId} rec={rec} />)}</ul>
        )}
      </section>

      {feedback.length > 0 && (
        <section aria-labelledby="fb-h">
          <h2 id="fb-h" className="text-[19px]">What families said</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {feedback.map((rec) => (
              <li key={rec.planId} className="card p-4">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold"><MessageSquare size={15} className="text-brand" aria-hidden="true" />{USEFUL[rec.pilot!.feedback!.useful]}{rec.pilot!.feedback!.didSomething && <span className="chip bg-ahead-soft text-ahead">Already acted on it</span>}</p>
                {rec.pilot!.feedback!.comment && <p className="mt-2 text-[14px] text-muted">&ldquo;{rec.pilot!.feedback!.comment}&rdquo;</p>}
                <p className="mt-2 text-[12.5px] text-muted">{rec.planId} · questionnaire {rec.working.generatedBy.questionnaireVersion ?? "not recorded"} · {when(rec.pilot!.feedback!.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QueueRow({ rec }: { rec: PlanRecord }) {
  const pilot = rec.pilot!;
  const urgent = rec.working.summary.urgent;
  const set = (patch: Parameters<typeof workspace.setPilot>[1]) => workspace.setPilot(rec.planId, patch);

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/plans/${rec.planId}`} className="text-[16px] font-semibold text-brand underline">{rec.profile.person.firstName} {rec.profile.person.lastName}</Link>
            <span className={clsx("chip", TONE[pilot.status])}>{PILOT_LABEL[pilot.status]}</span>
            {urgent && <span className="chip bg-now-soft text-now">Urgent flags: {urgent.items.length}</span>}
            {rec.source === "questionnaire" && <span className="chip bg-brand-soft text-brand">From the questionnaire</span>}
          </p>
          <p className="mt-1 text-[13.5px] text-muted">
            {rec.planId} · v{rec.working.version} · {rec.working.modules.length} topics · {rec.working.actions.length} actions
            {pilot.submittedAt ? ` · submitted ${when(pilot.submittedAt)}` : ""}{pilot.sentAt ? ` · sent ${when(pilot.sentAt)}` : ""}
          </p>
          {pilot.reviewNote && <p className="mt-1 text-[13.5px]"><span className="font-semibold">Review note:</span> {pilot.reviewNote}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {pilot.status !== "sent" && pilot.status !== "approved" && (
            <>
              <button className="btn-outline" onClick={() => set({ status: "approved", reviewedAt: new Date().toISOString(), reviewedBy: "Navigator" })}><CheckCircle2 size={15} aria-hidden="true" />Approve</button>
              <button className="btn-ghost" onClick={() => { const note = prompt("What needs changing before this plan goes out?"); if (note) set({ status: "changes_needed", reviewNote: note, reviewedAt: new Date().toISOString() }); }}>Changes needed</button>
            </>
          )}
          {pilot.status === "approved" && <button className="btn-primary" onClick={() => set({ status: "sent", sentAt: new Date().toISOString() })}><Send size={15} aria-hidden="true" />Mark as sent</button>}
          {pilot.status === "sent" && <button className="btn-ghost" onClick={() => set({ status: "approved", sentAt: undefined })}><Undo2 size={15} aria-hidden="true" />Undo sent</button>}
        </div>
      </div>
    </li>
  );
}
