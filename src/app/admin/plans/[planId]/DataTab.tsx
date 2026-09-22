"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { Action } from "@/lib/schema";
import { api, workspace, type PlanRecord } from "@/lib/workspace";
import { Card, Issues } from "@/components/ui";

/** What a model is asked to return: an action without the fields the system owns (key, status, dates, source). */
const AiSuggestion = Action.pick({ title: true, description: true, priority: true, timing: true, responsible: true, moduleId: true }).extend({ rationale: z.string().min(10) });

export function DataTab({ rec }: { rec: PlanRecord }) {
  const [check, setCheck] = useState<{ ok: boolean; errors: { path: string; message: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const json = JSON.stringify(rec.working, null, 2);
  const firstModule = rec.working.modules[0]?.id ?? "future-planning";
  const SAMPLES = {
    valid: { title: "Ask the pharmacist for a medicines review", description: "A pharmacist can check for medicines that add to falls risk or interact.", priority: "soon", timing: "Within a month", responsible: rec.profile.preparedFor.name, moduleId: firstModule, rationale: "Several conditions and a recent fall make a medicines review worthwhile." },
    invalid: { title: "", description: "Missing priority and module, and an empty title.", timing: "Soon", responsible: "Family", rationale: "short" },
  };
  const [ai, setAi] = useState(JSON.stringify(SAMPLES.valid, null, 2));
  const [aiIssues, setAiIssues] = useState<{ path: string; message: string }[] | null>(null);
  const [aiDone, setAiDone] = useState("");

  const validate = async () => { setBusy(true); try { setCheck(await api("/api/plans/validate", rec.working)); } finally { setBusy(false); } };
  const addAi = () => {
    setAiDone("");
    let raw: unknown;
    try { raw = JSON.parse(ai); } catch (e) { return setAiIssues([{ path: "", message: (e as Error).message }]); }
    const r = AiSuggestion.safeParse(raw);
    if (!r.success) return setAiIssues(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    if (!rec.working.modules.some((m) => m.id === r.data.moduleId)) return setAiIssues([{ path: "moduleId", message: `This plan has no module "${r.data.moduleId}"` }]);
    setAiIssues(null);
    const now = new Date().toISOString();
    const n = rec.working.actions.filter((a) => a.source === "ai").length + 1;
    const { rationale, ...rest } = r.data;
    const action: Action = { ...rest, key: `${r.data.moduleId}:ai-${n}`, status: "not_started", source: "ai", notes: `AI suggestion. Reason given: ${rationale}`, createdAt: now, updatedAt: now };
    const modules = rec.working.modules.map((m) => (m.id === action.moduleId ? { ...m, actionKeys: [...m.actionKeys, action.key] } : m));
    workspace.upsert({ ...rec, working: { ...rec.working, actions: [...rec.working.actions, action], modules } });
    setAiDone(`Added "${action.title}" as an AI-sourced action. It is marked in the plan and kept on regeneration; save progress to make it part of a version.`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="The plan as structured data" actions={<div className="flex gap-2"><button className="btn-outline !min-h-[34px]" onClick={() => navigator.clipboard.writeText(json)}><Copy size={14} aria-hidden="true" />Copy</button><button className="btn-primary !min-h-[34px]" onClick={validate} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}Validate on the server</button></div>}>
        <p className="mb-3 text-[13.5px] text-muted">This record is the plan. The PDFs are generated from it, and any other system (a family dashboard, reminders, a CRM) can read the same JSON through the API.</p>
        {check && (check.ok ? <p role="status" className="mb-3 rounded-lg bg-ahead-soft p-3 text-[13.5px] font-semibold text-ahead">Valid against the Action Plan schema, and every module points at real actions.</p> : <Issues items={check.errors} />)}
        <pre className="code max-h-[560px] overflow-auto">{json}</pre>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Sparkles size={18} aria-hidden="true" />Structured AI output</span>}>
        <p className="text-[13.5px] text-muted">AI is a later stage, but the contract is ready: a model returns an action in this shape, the system validates it, then adds it with <code className="font-mono">source: &quot;ai&quot;</code> so it can always be told apart from rule-based actions and reviewed by a person.</p>
        <div className="mt-3 flex gap-2"><button className="btn-ghost !min-h-[32px]" onClick={() => { setAi(JSON.stringify(SAMPLES.valid, null, 2)); setAiIssues(null); }}>Valid example</button><button className="btn-ghost !min-h-[32px]" onClick={() => { setAi(JSON.stringify(SAMPLES.invalid, null, 2)); setAiIssues(null); }}>Invalid example</button></div>
        <label htmlFor="ai" className="sr-only">AI suggestion JSON</label>
        <textarea id="ai" value={ai} onChange={(e) => setAi(e.target.value)} rows={12} spellCheck={false} className="field mt-2 font-mono text-[12.5px]" />
        <button className="btn-primary mt-3" onClick={addAi}>Validate and add to the plan</button>
        {aiIssues && <Issues items={aiIssues} />}
        {aiDone && <p role="status" className="mt-3 rounded-lg bg-ahead-soft p-3 text-[13.5px] text-ahead">{aiDone}</p>}
      </Card>
    </div>
  );
}
