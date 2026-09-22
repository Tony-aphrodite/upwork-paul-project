"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileJson, FolderOpen, Loader2, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import cases from "../../../content/cases.json";
import { FamilyProfile } from "@/lib/schema";
import { createPlan, importJson } from "@/lib/client-actions";
import { useWorkspace, workspace } from "@/lib/workspace";
import { Card, Issues } from "@/components/ui";

export default function WorkspacePage() {
  const ws = useWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ error: string; issues: { path: string; message: string }[] } | null>(null);
  const [text, setText] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (!ws) return <p className="text-muted">Loading workspace…</p>;
  const plans = Object.values(ws.plans).sort((a, b) => b.working.updatedAt.localeCompare(a.working.updatedAt));

  const fromCase = async (id: string) => {
    const existing = plans.find((p) => p.caseId === id);
    if (existing) return router.push(`/admin/plans/${existing.planId}`);
    setBusy(id);
    try { const c = cases.find((x) => x.id === id)!; router.push(`/admin/plans/${await createPlan(FamilyProfile.parse(c.profile), id)}`); } finally { setBusy(null); }
  };
  const doImport = async (json: string) => {
    setBusy("import"); setError(null);
    const r = await importJson(json).catch((e: Error & { details?: { path: string; message: string }[] }) => ({ ok: false as const, error: e.message, issues: e.details ?? [] }));
    setBusy(null);
    if (r.ok) router.push(`/admin/plans/${r.planId}`); else setError(r);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Test console</p><h1 className="mt-1 text-[28px]">Workspace</h1><p className="mt-1 max-w-2xl text-muted">Load a fictional family, paste or upload profile data, then preview the plan, change the data and regenerate.</p></div>
        {plans.length > 0 && <button className="btn-ghost" onClick={() => { if (confirm("Remove all plans from this browser?")) workspace.clear(); }}><RotateCcw size={15} aria-hidden="true" />Reset workspace</button>}
      </div>

      <section aria-labelledby="cases-h">
        <h2 id="cases-h" className="text-[19px]">Test cases</h2>
        <p className="text-[14px] text-muted">Six scenarios from the brief, plus a long-content case that switches on 16 of the 18 modules.</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cases.map((c) => {
            const loaded = plans.find((p) => p.caseId === c.id);
            return (
              <li key={c.id} className="card flex flex-col p-4">
                <h3 className="text-[15.5px]">{c.title}</h3>
                <p className="mt-1 flex-1 text-[13.5px] text-muted">{c.summary}</p>
                <button onClick={() => fromCase(c.id)} disabled={busy !== null} className={loaded ? "btn-outline mt-3" : "btn-primary mt-3"}>
                  {busy === c.id ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : loaded ? <FolderOpen size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                  {loaded ? `Open plan (v${loaded.working.version})` : "Create plan"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Card title={`Plans in this workspace (${plans.length})`}>
        {plans.length === 0 ? <p className="text-[14px] text-muted">No plans yet. Create one from a test case or import data below.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead className="border-b border-line"><tr><th className="th">Person</th><th className="th">Plan</th><th className="th">Version</th><th className="th">Open actions</th><th className="th">Updated</th><th className="th"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-line">
                {plans.map((p) => (
                  <tr key={p.planId}>
                    <td className="td font-semibold">{p.profile.person.firstName} {p.profile.person.lastName}<span className="block text-[12.5px] font-normal text-muted">{p.profile.person.age}, {p.profile.person.town}</span></td>
                    <td className="td font-mono text-[13px]">{p.planId}</td>
                    <td className="td">{p.working.version}<span className="text-muted"> · {p.versions.length} saved</span></td>
                    <td className="td">{p.working.actions.filter((a) => a.status !== "completed" && a.status !== "no_longer_required").length}</td>
                    <td className="td text-muted">{new Date(p.working.updatedAt).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="td text-right"><div className="flex justify-end gap-1"><Link href={`/admin/plans/${p.planId}`} className="btn-outline !min-h-[34px]">Open<ArrowRight size={14} aria-hidden="true" /></Link><button className="btn-ghost !min-h-[34px] !px-2" aria-label={`Delete plan ${p.planId}`} onClick={() => { if (confirm(`Delete ${p.planId}?`)) workspace.remove(p.planId); }}><Trash2 size={15} aria-hidden="true" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><FileJson size={18} aria-hidden="true" />Paste or upload test data</span>}>
        <p className="text-[14px] text-muted">A Family Profile creates a new plan. An export bundle (profile and versions) restores a plan with its history. Both are validated against the schemas, and every problem is listed with its path.</p>
        <label htmlFor="json" className="sr-only">JSON data</label>
        <textarea id="json" value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false} placeholder='{ "schemaVersion": "1.0", "profileId": "FP-...", ... }' className="field mt-3 font-mono text-[12.5px]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!text.trim() || busy !== null} onClick={() => doImport(text)}>{busy === "import" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}Validate and create plan</button>
          <button className="btn-outline" onClick={() => file.current?.click()}><Upload size={15} aria-hidden="true" />Upload a .json file</button>
          <button className="btn-ghost" onClick={() => { const c = cases[0].profile; setText(JSON.stringify({ ...c, profileId: "FP-PASTE01", person: { ...c.person, firstName: "Pat" } }, null, 2)); }}>Fill with an example</button>
          <button className="btn-ghost" onClick={() => setText(JSON.stringify({ schemaVersion: "1.0", profileId: "bad id", person: { firstName: "Pat", age: 12 } }, null, 2))}>Try invalid data</button>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); doImport(t); } e.target.value = ""; }} />
        </div>
        {error && <><p className="mt-3 font-semibold text-now">{error.error}</p>{error.issues.length > 0 && <Issues items={error.issues} />}</>}
      </Card>
    </div>
  );
}
