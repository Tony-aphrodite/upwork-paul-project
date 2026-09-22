"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ModuleDefinition } from "@/lib/schema";
import { builtInLibrary } from "@/lib/library";
import { describe } from "@/lib/describe";
import { regenerate } from "@/lib/client-actions";
import { useWorkspace, workspace } from "@/lib/workspace";
import { Card, Issues, PriorityChip } from "@/components/ui";

const EXAMPLE = {
  id: "hearing-and-vision",
  title: "Hearing and vision",
  order: 125,
  headline: "Check hearing and eyesight",
  when: { any: [{ field: "social.isolation", op: "in", value: ["moderate", "high"] }, { field: "person.age", op: "gte", value: 85 }] },
  priority: { default: "plan_ahead", rules: [{ when: { field: "mobility.fallsLast12Months", op: "gte", value: 1 }, level: "soon" }] },
  noticed: [{ text: "Hearing and eyesight have not been checked recently." }],
  whyItMatters: "Untreated hearing and vision loss add to falls, confusion and isolation, and are often easy to improve.",
  whoCanHelp: ["Audiologist", "Optometrist", "GP"],
  questions: [{ for: "GP", question: "Should {{name}} be referred for a hearing test?" }],
  actions: [{ id: "eye-test", title: "Book an eye test", description: "An optometrist can check for cataracts and update glasses.", timing: "Within 3 months", responsible: "{{preparedFor}}" }],
};

export default function ModulesPage() {
  const ws = useWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState(JSON.stringify(EXAMPLE, null, 2));
  const [issues, setIssues] = useState<{ path: string; message: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!ws) return <p className="text-muted">Loading…</p>;
  const custom = ModuleDefinition.array().safeParse(ws.customModules).data ?? [];
  const customIds = new Set(custom.map((m) => m.id));
  const all = [...builtInLibrary.modules.filter((m) => !customIds.has(m.id)), ...custom].sort((a, b) => a.order - b.order);

  const add = () => {
    setMsg("");
    let raw: unknown;
    try { raw = JSON.parse(text); } catch (e) { return setIssues([{ path: "", message: (e as Error).message }]); }
    const r = ModuleDefinition.safeParse(raw);
    if (!r.success) return setIssues(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    setIssues(null);
    workspace.update((w) => ({ ...w, customModules: [...(w.customModules as { id: string }[]).filter((m) => m.id !== r.data.id), r.data] }));
    setMsg(`Module "${r.data.title}" added. Apply it to existing plans below, or create a new plan.`);
  };
  const applyAll = async () => {
    setBusy(true); setMsg("");
    const plans = Object.values(workspace.get().plans);
    let n = 0;
    for (const p of plans) { await regenerate(workspace.get().plans[p.planId], p.profile, "Module library updated"); n++; }
    setBusy(false); setMsg(`Regenerated ${n} plan${n === 1 ? "" : "s"} with the current module library. Each got a new version; see its Versions tab for what changed.`);
  };

  return (
    <div className="space-y-6">
      <div><p className="eyebrow">Content, not code</p><h1 className="mt-1 text-[28px]">Action Plan modules</h1><p className="mt-1 max-w-3xl text-muted">Each module is a JSON record with the conditions that switch it on, how its priority is set, and its text and actions. The engine only reads records like these, so adding or changing a module needs no code and no rebuild.</p></div>

      <Card title={`Library (${all.length} modules)`}>
        <ul className="divide-y divide-line">
          {all.map((m) => (
            <li key={m.id} className="py-3">
              <button className="flex w-full items-start justify-between gap-4 text-left" aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                <span className="min-w-0"><span className="font-semibold">{m.title}</span>{customIds.has(m.id) && <span className="ml-2 chip bg-gold/30 text-ink">Custom</span>}<span className="mt-0.5 block text-[13px] text-muted"><span className="font-semibold text-ink">Shown when</span> {describe(m.when)}</span></span>
                <span className="flex shrink-0 items-center gap-2"><PriorityChip p={m.priority.default} /><span className="text-[12.5px] text-muted">{m.actions.length} actions</span><ChevronDown size={16} aria-hidden="true" className={openId === m.id ? "rotate-180" : ""} /></span>
              </button>
              {openId === m.id && (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="text-[13.5px]">
                    <p className="font-semibold">Priority rules</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">{m.priority.rules.map((r, i) => <li key={i}><PriorityChip p={r.level} /> when {describe(r.when)}</li>)}<li>otherwise <PriorityChip p={m.priority.default} /></li></ul>
                    <p className="mt-3 font-semibold">Actions</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">{m.actions.map((a) => <li key={a.id}>{a.title}{a.when && <span> <em>(only if {describe(a.when)})</em></span>}</li>)}</ul>
                    {customIds.has(m.id) && <button className="btn-ghost mt-3 !text-now" onClick={() => workspace.update((w) => ({ ...w, customModules: (w.customModules as { id: string }[]).filter((x) => x.id !== m.id) }))}><Trash2 size={15} aria-hidden="true" />Remove custom module</button>}
                  </div>
                  <pre className="code max-h-80 overflow-auto">{JSON.stringify(m, null, 2)}</pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Plus size={18} aria-hidden="true" />Add a module</span>}>
        <p className="text-[13.5px] text-muted">Validated against the module schema before it is accepted. The example adds a &ldquo;Hearing and vision&rdquo; topic for older or isolated people.</p>
        <label htmlFor="mod" className="sr-only">Module JSON</label>
        <textarea id="mod" value={text} onChange={(e) => setText(e.target.value)} rows={16} spellCheck={false} className="field mt-3 font-mono text-[12.5px]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={add}>Validate and add</button>
          <button className="btn-outline" onClick={applyAll} disabled={busy || !Object.keys(ws.plans).length}>{busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}Apply the library to all plans</button>
        </div>
        {issues && <Issues items={issues} />}
        {msg && <p role="status" className="mt-3 rounded-lg bg-ahead-soft p-3 text-[13.5px] text-ahead">{msg}</p>}
      </Card>
    </div>
  );
}
