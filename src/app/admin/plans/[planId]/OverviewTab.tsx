"use client";

import type { PlanRecord } from "@/lib/workspace";
import { Card, PriorityChip } from "@/components/ui";

export function OverviewTab({ rec }: { rec: PlanRecord }) {
  const plan = rec.working;
  const open = plan.actions.filter((a) => a.status !== "completed" && a.status !== "no_longer_required");
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5">
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
