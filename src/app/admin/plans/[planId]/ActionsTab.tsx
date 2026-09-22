"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Action, type Priority } from "@/lib/schema";
import { saveProgress } from "@/lib/engine/generate";
import { workspace, type PlanRecord } from "@/lib/workspace";
import { Card, PriorityChip, StatusChip } from "@/components/ui";

export function ActionsTab({ rec, dirty }: { rec: PlanRecord; dirty: boolean }) {
  const [reason, setReason] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const plan = rec.working;
  const latest = rec.versions.at(-1)!;
  const mods = new Map(plan.modules.map((m) => [m.id, m.title]));
  const update = (key: string, patch: Partial<Action>) => workspace.upsert({ ...rec, working: { ...plan, actions: plan.actions.map((a) => (a.key === key ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)) } });
  const save = () => { const v = saveProgress(rec.working, latest, reason.trim() || "Progress update"); workspace.upsert({ ...rec, versions: [...rec.versions, v], working: v }); setReason(""); };
  const shown = plan.actions.filter((a) => showClosed || (a.status !== "completed" && a.status !== "no_longer_required"));

  return (
    <div className="space-y-5">
      {dirty && (
        <div className="card flex flex-wrap items-end gap-3 border-soon/40 bg-soon-soft/60 p-4">
          <div className="min-w-[240px] flex-1"><label htmlFor="reason" className="label">You have unsaved progress. Describe the update</label><input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Smoke alarms fitted, GP appointment booked" className="field" /></div>
          <button className="btn-primary" onClick={save}><Save size={15} aria-hidden="true" />Save as version {latest.version.split(".")[0]}.{Number(latest.version.split(".")[1]) + 1}</button>
        </div>
      )}
      <Card title={`Actions (${shown.length})`} actions={<label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Show completed and retired</label>}>
        <p className="mb-3 text-[13.5px] text-muted">Each action is its own record. Change a status, owner or note here; the documents pick it up, and regenerating from a changed profile keeps it.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[14px]">
            <thead className="border-b border-line"><tr><th className="th w-24">Priority</th><th className="th">Action</th><th className="th w-44">Responsible</th><th className="th w-52">Status</th><th className="th w-56">Notes</th></tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <tr key={a.key} className={a.status === "no_longer_required" ? "opacity-60" : ""}>
                  <td className="td"><PriorityChip p={a.priority} /></td>
                  <td className="td"><p className="font-semibold">{a.title}</p><p className="text-[12.5px] text-muted">{mods.get(a.moduleId) ?? (a.source === "ai" ? "AI suggestion" : "Added by navigator")} · {a.timing} · <span className="font-mono">{a.source}</span></p></td>
                  <td className="td"><label className="sr-only" htmlFor={`r-${a.key}`}>Responsible for {a.title}</label><input id={`r-${a.key}`} value={a.responsible} onChange={(e) => update(a.key, { responsible: e.target.value })} className="field !min-h-[34px] !py-1" /></td>
                  <td className="td"><label className="sr-only" htmlFor={`s-${a.key}`}>Status of {a.title}</label>
                    <select id={`s-${a.key}`} value={a.status} onChange={(e) => update(a.key, { status: e.target.value as Action["status"] })} className="field !min-h-[34px] !py-1">{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
                    <div className="mt-1"><StatusChip s={a.status} /></div></td>
                  <td className="td"><label className="sr-only" htmlFor={`n-${a.key}`}>Notes for {a.title}</label><textarea id={`n-${a.key}`} value={a.notes} onChange={(e) => update(a.key, { notes: e.target.value })} rows={2} className="field !min-h-[34px] !py-1 text-[13px]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AddAction rec={rec} />
    </div>
  );
}

function AddAction({ rec }: { rec: PlanRecord }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("soon");
  const [timing, setTiming] = useState("Within a month");
  const [who, setWho] = useState(rec.profile.preparedFor.name);
  const add = () => {
    const now = new Date().toISOString();
    const n = rec.working.actions.filter((a) => a.moduleId === "navigator").length + 1;
    const action: Action = { key: `navigator:custom-${n}`, title: title.trim(), description: "Added by the navigator.", priority, timing, responsible: who, status: "not_started", moduleId: "navigator", source: "navigator", notes: "", createdAt: now, updatedAt: now };
    workspace.upsert({ ...rec, working: { ...rec.working, actions: [...rec.working.actions, action] } });
    setTitle("");
  };
  return (
    <Card title="Add an action by hand">
      <p className="mb-3 text-[13.5px] text-muted">Navigator-added actions are marked as such and are never removed when the plan is regenerated.</p>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
        <div><label htmlFor="na-title" className="label">Action</label><input id="na-title" value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder="e.g. Book a hearing test" /></div>
        <div><label htmlFor="na-p" className="label">Priority</label><select id="na-p" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="field">{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
        <div><label htmlFor="na-t" className="label">Timing</label><input id="na-t" value={timing} onChange={(e) => setTiming(e.target.value)} className="field" /></div>
        <div><label htmlFor="na-w" className="label">Responsible</label><input id="na-w" value={who} onChange={(e) => setWho(e.target.value)} className="field" /></div>
        <button className="btn-outline" disabled={!title.trim()} onClick={add}><Plus size={15} aria-hidden="true" />Add</button>
      </div>
    </Card>
  );
}
