"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PILOT_LABEL, type PlanRecord } from "@/lib/workspace";
import { Card, PriorityChip } from "@/components/ui";

export function OverviewTab({ rec }: { rec: PlanRecord }) {
  const plan = rec.working;
  const open = plan.actions.filter((a) => a.status !== "completed" && a.status !== "no_longer_required");
  const urgent = plan.summary.urgent;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
        {urgent && (
          <section className="rounded-xl border-2 border-now bg-now-soft p-4" aria-labelledby="urg-h">
            <h2 id="urg-h" className="flex items-center gap-2 text-[17px] text-now"><AlertTriangle size={18} aria-hidden="true" />Flagged as possibly urgent by the family</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px]">{urgent.items.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="mt-2 text-[13.5px]">{urgent.guidance}</p>
            <p className="mt-1 text-[12.5px] text-muted">Kept out of the ordinary action list on purpose, in both the plan and the PDF.</p>
          </section>
        )}
        {rec.pilot && (
          <p className="rounded-lg bg-brand-soft px-4 py-2.5 text-[14px]">
            Pilot status: <strong>{PILOT_LABEL[rec.pilot.status]}</strong>
            {rec.working.generatedBy.questionnaireVersion ? <> · questionnaire {rec.working.generatedBy.questionnaireVersion}</> : null}
            {" "}<Link href="/admin/pilot" className="font-semibold text-brand underline">Open the review queue</Link>
          </p>
        )}
        <Card title="Plan at a glance">
          <div className="rounded-lg bg-brand p-4 text-white"><p className="text-[12px] font-bold uppercase tracking-wider text-white/70">Recommended next step</p><p className="mt-1 font-display text-[19px]">{plan.summary.nextStep}</p></div>
          <ol className="mt-4 space-y-3">
            {plan.priorities.map((p, i) => <li key={p.moduleId} className="flex gap-3"><span className="font-display text-[20px] leading-none text-brand">{i + 1}</span><div><p className="font-semibold">{p.title} <PriorityChip p={p.level} /></p><p className="text-[14px] text-muted">{p.why}</p></div></li>)}
          </ol>
        </Card>
        <Card title="What you told us">{plan.summary.situation.map((s, i) => <p key={i} className="mt-1.5 text-[14.5px] first:mt-0">{s}</p>)}</Card>
      </div>
      <div className="space-y-5">
        <Card title={`Modules included (${plan.modules.length} of 18)`}>
          <p className="text-[13.5px] text-muted">Each module switched on because a rule matched this profile. The rest are left out of the plan entirely.</p>
          <ul className="mt-3 space-y-1.5">{plan.modules.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 text-[14px]"><span>{m.title}<span className="text-muted"> · {m.actionKeys.length} actions</span></span><PriorityChip p={m.priority} /></li>)}</ul>
        </Card>
        <Card title="Counts">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {([["Open actions", open.length], ["Start now", open.filter((a) => a.priority === "now").length], ["Options shown", plan.providerMatches.length]] as const).map(([k, v]) => <div key={k} className="rounded-lg bg-sand p-3"><dd className="font-display text-[24px] text-brand">{v}</dd><dt className="text-[12.5px] text-muted">{k}</dt></div>)}
          </dl>
        </Card>
      </div>
    </div>
  );
}
