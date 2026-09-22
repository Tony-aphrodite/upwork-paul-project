"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { renderPlanHtml, renderSummaryHtml } from "@/doc/templates";
import { downloadPdf, type PlanRecord } from "@/lib/workspace";

export function DocumentsTab({ rec, version, onVersion }: { rec: PlanRecord; version: string | null; onVersion: (v: string | null) => void }) {
  const [kind, setKind] = useState<"plan" | "summary">("plan");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const plan = version ? rec.versions.find((v) => v.version === version) ?? rec.working : rec.working;
  const html = useMemo(() => (kind === "plan" ? renderPlanHtml : renderSummaryHtml)(plan, rec.profile, { fonts: { kind: "url", base: "/fonts" } }), [kind, plan, rec.profile]);

  const pdf = async (k: "plan" | "summary") => {
    setBusy(k); setMsg("");
    try { const pages = await downloadPdf(k, plan, rec.profile); setMsg(`Downloaded ${k === "plan" ? "the Family Action Plan" : "the Professional Summary"}: ${pages} page${pages === 1 ? "" : "s"}.`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };
  const openPdf = async () => {
    setBusy("open");
    const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, plan, profile: rec.profile }) });
    setBusy(null);
    if (res.ok) window.open(URL.createObjectURL(await res.blob()), "_blank", "noopener");
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div role="group" aria-label="Document" className="flex rounded-lg border border-line p-0.5">
          {([["plan", "Family Action Plan"], ["summary", "Professional Summary"]] as const).map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={clsx("rounded-md px-3 py-1.5 text-[13.5px] font-semibold", kind === k ? "bg-brand text-white" : "text-muted")}>{l}</button>)}
        </div>
        <label className="flex items-center gap-2 text-[13.5px]"><span className="font-semibold">Version</span>
          <select value={version ?? ""} onChange={(e) => onVersion(e.target.value || null)} className="field !min-h-[34px] !w-auto !py-1">
            <option value="">Current ({rec.working.version}{JSON.stringify(rec.working.actions) !== JSON.stringify(rec.versions.at(-1)!.actions) ? ", with unsaved progress" : ""})</option>
            {[...rec.versions].reverse().map((v) => <option key={v.version} value={v.version}>Version {v.version}</option>)}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn-outline" onClick={openPdf} disabled={!!busy}>{busy === "open" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={15} aria-hidden="true" />}Open exact PDF</button>
          <button className="btn-primary" onClick={() => pdf("plan")} disabled={!!busy}>{busy === "plan" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}Action Plan PDF</button>
          <button className="btn-primary" onClick={() => pdf("summary")} disabled={!!busy}>{busy === "summary" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}Summary PDF</button>
        </div>
        {msg && <p role="status" className="w-full text-[13.5px] text-muted">{msg}</p>}
      </div>
      <p className="text-[13px] text-muted">The preview uses the same HTML and CSS template as the server PDF. Page numbers, running footers and exact page breaks appear in the PDF.</p>
      <iframe title={`${kind === "plan" ? "Family Action Plan" : "Professional Summary"} preview`} srcDoc={html} sandbox="" className="h-[80vh] w-full rounded-xl border border-line bg-[#E4E8E9]" />
    </div>
  );
}
