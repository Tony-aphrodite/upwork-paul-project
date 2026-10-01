"use client";

import clsx from "clsx";
import { Undo2, X } from "lucide-react";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/priority";
import type { PilotPlan, PlanAction, PlanInfo, PlanPathway } from "@/lib/pilot/plan";
import { INFO_SECTIONS } from "@/lib/pilot/content";
import { PATHWAY_LABEL } from "@/lib/format";
import { Box, Input, Lines, TextArea } from "./fields";

const INFO_TITLE: Record<PlanInfo["section"], string> = { funding: "E. Funding and assessment", check: "G. Things to check", professional: "H. Professional assessment or advice" };

function RemoveToggle({ removed, what, onToggle }: { removed: boolean; what: string; onToggle: () => void }) {
  return (
    <button type="button" className="btn-ghost !min-h-0 !px-2 !py-1" onClick={onToggle} aria-label={`${removed ? "Restore" : "Remove"}: ${what}`}>
      {removed ? <><Undo2 size={14} aria-hidden="true" />Restore</> : <><X size={14} aria-hidden="true" />Remove</>}
    </button>
  );
}

/** Every wording field of the plan, editable; pathways, actions and information can be removed and restored. */
export function PlanForm({ plan, onChange, note, onNote, releasedNote }: { plan: PilotPlan; onChange: (p: PilotPlan) => void; note: string; onNote: (v: string) => void; releasedNote?: string }) {
  const editAction = (key: string, patch: Partial<PlanAction>) => onChange({ ...plan, actions: plan.actions.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const editInfo = (id: string, patch: Partial<PlanInfo>) => onChange({ ...plan, information: plan.information.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const editPathway = (i: number, patch: Partial<PlanPathway>) => onChange({ ...plan, pathways: plan.pathways.map((p, n) => (n === i ? { ...p, ...patch } : p)) });
  const removed = plan.actions.filter((a) => a.removed).length;
  const livePathways = plan.pathways.filter((p) => !p.removed).length;

  return (
    <div className="space-y-5">
      {releasedNote && <p className="rounded-lg bg-brand-soft p-3 text-[14px] text-brand">{releasedNote}</p>}
      <Box title="Introduction"><TextArea value={plan.intro} onChange={(v) => onChange({ ...plan, intro: v })} rows={3} label="Introduction" /></Box>
      {plan.urgent && (
        <Box title="Urgent attention" tone="now">
          <Lines value={plan.urgent.items} onChange={(v) => onChange({ ...plan, urgent: { ...plan.urgent!, items: v } })} label="Urgent items, one per line" />
          <TextArea value={plan.urgent.guidance} onChange={(v) => onChange({ ...plan, urgent: { ...plan.urgent!, guidance: v } })} rows={3} label="Guidance" />
        </Box>
      )}
      <Box title="A. Your current situation"><Lines value={plan.situation} onChange={(v) => onChange({ ...plan, situation: v })} label="One sentence per line" /></Box>
      <Box title="B. What matters most"><Lines value={plan.matters} onChange={(v) => onChange({ ...plan, matters: v })} label="One sentence per line" /></Box>
      <Box title="C. Likely pathway">
        {livePathways === 0 && <TextArea value={plan.pathwayNote} onChange={(v) => onChange({ ...plan, pathwayNote: v })} rows={3} label="Shown when no pathway applies" />}
        {plan.pathways.map((p, i) => (
          <div key={`${p.id}-${i}`} className={clsx("rounded-lg border p-3", p.removed ? "border-dashed border-line opacity-70" : "border-line")}>
            <div className="flex items-center justify-between gap-2"><p className="font-semibold">{PATHWAY_LABEL[p.id]}</p><RemoveToggle removed={p.removed} what={p.name} onToggle={() => editPathway(i, { removed: !p.removed })} /></div>
            {p.removed ? <p className="text-[14px] line-through">{p.name}</p> : <>
              <Input value={p.name} onChange={(v) => editPathway(i, { name: v })} label="Heading" />
              <TextArea value={p.explanation} onChange={(v) => editPathway(i, { explanation: v })} rows={3} label="Explanation" />
            </>}
          </div>
        ))}
      </Box>

      <Box title={`D. Priority actions (${plan.actions.length - removed}${removed ? `, ${removed} removed` : ""})`}>
        <p className="-mt-1 text-[13px] text-muted">The family&rsquo;s plan lists actions by priority: Now, then Soon, then Plan ahead.</p>
        {plan.actions.map((a) => (
          <div key={a.key} className={clsx("rounded-lg border p-3", a.removed ? "border-dashed border-line bg-paper opacity-70" : "border-line bg-white")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-muted">{a.topic} · <span className="font-mono">{a.key}</span></span>
              <div className="flex items-center gap-2">
                {!a.removed && <select aria-label={`Priority: ${a.title}`} className="field !min-h-[32px] !w-auto !py-1" value={a.priority} onChange={(e) => editAction(a.key, { priority: e.target.value as PlanAction["priority"] })}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>}
                <RemoveToggle removed={a.removed} what={a.title} onToggle={() => editAction(a.key, { removed: !a.removed })} />
              </div>
            </div>
            {a.removed ? <p className="mt-1 text-[14px] line-through">{a.title}</p> : (
              <div className="mt-2 grid gap-2.5">
                <Input value={a.title} onChange={(v) => editAction(a.key, { title: v })} label="What to do" />
                <TextArea value={a.why} onChange={(v) => editAction(a.key, { why: v })} rows={2} label="Why it matters" />
                <TextArea value={a.nextStep} onChange={(v) => editAction(a.key, { nextStep: v })} rows={2} label="Next step" />
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Lines value={a.whoCanHelp} onChange={(v) => editAction(a.key, { whoCanHelp: v })} label="Who can help" />
                  <Lines value={a.prepare} onChange={(v) => editAction(a.key, { prepare: v })} label="What to prepare" />
                  <Lines value={a.questions} onChange={(v) => editAction(a.key, { questions: v })} label="Questions to ask" />
                  <Lines value={a.check} onChange={(v) => editAction(a.key, { check: v })} label="Things to check" />
                </div>
              </div>
            )}
          </div>
        ))}
      </Box>

      {INFO_SECTIONS.map((section) => plan.information.some((i) => i.section === section) && (
        <Box key={section} title={INFO_TITLE[section]}>
          {plan.information.filter((i) => i.section === section).map((i) => (
            <div key={i.id} className={clsx("rounded-lg border p-3", i.removed ? "border-dashed border-line opacity-70" : "border-line")}>
              <div className="flex justify-end"><RemoveToggle removed={i.removed} what={i.title || i.text.slice(0, 40)} onToggle={() => editInfo(i.id, { removed: !i.removed })} /></div>
              {i.removed ? <p className="text-[14px] line-through">{i.title || i.text}</p> : <><Input value={i.title} onChange={(v) => editInfo(i.id, { title: v })} label="Title" /><TextArea value={i.text} onChange={(v) => editInfo(i.id, { text: v })} rows={3} label="Text" /></>}
            </div>
          ))}
        </Box>
      ))}

      <Box title="J. Help from Ageing Navigator"><TextArea value={plan.cta} onChange={(v) => onChange({ ...plan, cta: v })} rows={2} label="Invitation" /></Box>
      <Box title="Internal note (never shown to the family)"><TextArea value={note} onChange={onNote} rows={3} label="Note" /></Box>
    </div>
  );
}
