"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { FamilyProfile } from "@/lib/schema";
import { regenerate } from "@/lib/client-actions";
import type { PlanRecord } from "@/lib/workspace";
import { Card, Issues } from "@/components/ui";

type Field = { path: string; label: string; options?: [string, string][]; kind?: "number" | "bool" };
const O = (...xs: string[]): [string, string][] => xs.map((x) => [x, x.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())]);
const FIELDS: Field[] = [
  { path: "living.situation", label: "Living situation", options: O("alone", "with_partner", "with_family", "retirement_village", "residential_care", "other") },
  { path: "mobility.level", label: "Mobility", options: O("independent", "uses_aid", "needs_help", "wheelchair") },
  { path: "mobility.fallsLast12Months", label: "Falls in the last 12 months", kind: "number" },
  { path: "cognition.concern", label: "Memory concern", options: O("none", "mild", "moderate", "significant") },
  { path: "cognition.diagnosis", label: "Diagnosis", options: O("none", "mci", "dementia", "unknown") },
  { path: "hospital.status", label: "Hospital", options: O("none", "in_hospital", "discharged_recently") },
  { path: "support.mainCarer.strain", label: "Main carer strain", options: O("low", "moderate", "high") },
  { path: "funding.needsAssessment", label: "Needs assessment", options: O("none", "requested", "completed") },
  { path: "funding.budgetConcern", label: "Budget concern", options: O("none", "some", "significant") },
  { path: "legal.epoaProperty", label: "EPOA, property", options: O("yes", "no", "unsure") },
  { path: "legal.epoaWelfare", label: "EPOA, welfare", options: O("yes", "no", "unsure") },
  { path: "future.preference", label: "Future preference", options: O("stay_home", "retirement_village", "residential_care", "undecided") },
  { path: "future.timeframe", label: "Timeframe", options: O("now", "within_6_months", "within_2_years", "later") },
  { path: "homeSafety.smokeAlarms", label: "Working smoke alarms", kind: "bool" },
];

const get = (o: unknown, p: string) => p.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), o);
function set<T>(o: T, p: string, v: unknown): T {
  const copy = structuredClone(o) as Record<string, unknown>;
  const keys = p.split(".");
  let cur = copy;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys.at(-1)!] = v;
  return copy as T;
}
function changedPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b as object)]);
    return [...keys].flatMap((k) => changedPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

export function ProfileTab({ rec, onDone }: { rec: PlanRecord; onDone: () => void }) {
  const [draft, setDraft] = useState(rec.profile);
  const [json, setJson] = useState(() => JSON.stringify(rec.profile, null, 2));
  const [issues, setIssues] = useState<{ path: string; message: string }[] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const changes = changedPaths(rec.profile, draft);
  const fields = FIELDS.filter((f) => f.path !== "support.mainCarer.strain" || draft.support.mainCarer);

  const edit = (path: string, value: unknown) => { const next = set(draft, path, value); setDraft(next); setJson(JSON.stringify(next, null, 2)); };
  const applyJson = () => {
    try {
      const r = FamilyProfile.safeParse(JSON.parse(json));
      if (!r.success) return setIssues(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      if (r.data.profileId !== rec.profile.profileId) return setIssues([{ path: "profileId", message: "The profile ID cannot change for an existing plan" }]);
      setIssues(null); setDraft(r.data);
    } catch (e) { setIssues([{ path: "", message: (e as Error).message }]); }
  };
  const run = async () => {
    setBusy(true); setErr("");
    try { await regenerate(rec, draft, reason.trim() || `Profile updated: ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? "…" : ""}`); setReason(""); onDone(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Card title="Change the family's information">
        <p className="mb-4 text-[13.5px] text-muted">The fields that most often change between reviews. Everything else can be edited in the JSON below.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => {
            const v = get(draft, f.path);
            const id = `pf-${f.path}`;
            const changed = changes.includes(f.path);
            return (
              <div key={f.path}>
                <label htmlFor={id} className="label">{f.label}{changed && <span className="ml-1.5 chip bg-soon-soft text-soon">changed</span>}</label>
                {f.kind === "bool" ? <label className="flex min-h-[38px] items-center gap-2 text-[14px]"><input id={id} type="checkbox" checked={!!v} onChange={(e) => edit(f.path, e.target.checked)} />{v ? "Yes" : "No"}</label>
                  : f.kind === "number" ? <input id={id} type="number" min={0} max={50} value={Number(v ?? 0)} onChange={(e) => edit(f.path, Math.max(0, Math.round(Number(e.target.value) || 0)))} className="field" />
                  : <select id={id} value={String(v ?? "")} onChange={(e) => edit(f.path, e.target.value)} className="field">{f.options!.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Profile JSON">
        <label htmlFor="pjson" className="sr-only">Profile JSON</label>
        <textarea id="pjson" value={json} onChange={(e) => setJson(e.target.value)} rows={14} spellCheck={false} className="field font-mono text-[12.5px]" />
        <button className="btn-outline mt-3" onClick={applyJson}>Validate and use this JSON</button>
        {issues && <Issues items={issues} />}
      </Card>

      <div className="card sticky bottom-3 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <p className="text-[14px] font-semibold">{changes.length ? `${changes.length} change${changes.length > 1 ? "s" : ""}: ` : "No changes yet"}<span className="font-mono text-[12.5px] font-normal text-muted">{changes.join(", ")}</span></p>
          <label htmlFor="rreason" className="sr-only">Reason for the update</label>
          <input id="rreason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the update (optional)" className="field mt-2" />
        </div>
        <button className="btn-primary" disabled={!changes.length || busy} onClick={run}>{busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}Regenerate as a new version</button>
        {err && <p role="alert" className="w-full text-[13.5px] font-semibold text-now">{err}</p>}
      </div>
    </div>
  );
}
