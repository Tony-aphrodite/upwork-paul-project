"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, RotateCcw, Save } from "lucide-react";
import type { ActionPlan, FamilyProfile } from "@/lib/schema";
import type { Answers, QuestionDefinition, Questionnaire } from "@/lib/questionnaire/schema";
import { checkSection, isAnswered, progress, pruneAnswers, visibleSections, type Issue } from "@/lib/questionnaire/logic";
import { PlanResult } from "./PlanResult";

const KEY = "kinfield-questionnaire-draft-v1";

type Submitted = { plan: ActionPlan; profile: FamilyProfile; mapping: { inferred: string[]; notAsked: string[] } };

export function QuestionnaireForm({ doc }: { doc: Questionnaire }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(-1); // -1 is the introduction
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Submitted | null>(null);
  const [restored, setRestored] = useState(false);

  // A questionnaire this long is often finished in two sittings, so the draft stays in this browser until it is submitted.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { answers: Answers; step: number; version: string } | null;
      if (saved?.version === doc.version && Object.keys(saved.answers ?? {}).length) { setAnswers(saved.answers); setStep(saved.step ?? 0); setRestored(true); }
    } catch { /* a blocked or full store just means no draft */ }
  }, [doc.version]);
  useEffect(() => {
    if (step < 0 || result) return;
    try { localStorage.setItem(KEY, JSON.stringify({ answers, step, version: doc.version })); } catch { /* ignore */ }
  }, [answers, step, doc.version, result]);

  const sections = useMemo(() => visibleSections(doc, answers), [doc, answers]);
  const current = sections[Math.min(step, sections.length - 1)];
  const { answered, total, percent } = progress(doc, answers);
  const issueFor = (id: string) => issues.find((i) => i.questionId === id)?.message;

  const set = (id: string, value: Answers[string]) => { setAnswers((prev) => ({ ...prev, [id]: value })); setIssues((prev) => prev.filter((i) => i.questionId !== id)); };

  const next = () => {
    const found = checkSection(current, answers);
    setIssues(found);
    if (found.length) { document.getElementById(`q-${found[0].questionId}`)?.scrollIntoView({ block: "center" }); return; }
    const pruned = pruneAnswers(doc, answers);
    setAnswers(pruned);
    const after = visibleSections(doc, pruned);
    const index = after.findIndex((s) => s.id === current.id);
    if (index + 1 < after.length) { setStep(index + 1); window.scrollTo({ top: 0 }); } else void submit(pruned);
  };

  async function submit(final: Answers) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/questionnaire/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: final }) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong."); setIssues((json.details ?? []).map((d: { path: string; message: string }) => ({ questionId: d.path, message: d.message }))); return; }
      setResult(json as Submitted);
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      window.scrollTo({ top: 0 });
    } catch {
      setError("We could not reach the server. Your answers are still saved in this browser, so you can try again.");
    } finally { setBusy(false); }
  }

  if (result) return <PlanResult plan={result.plan} profile={result.profile} mapping={result.mapping} questionnaireVersion={doc.version} />;

  if (step < 0) {
    return (
      <div className="card mx-auto max-w-3xl p-6 sm:p-8">
        <p className="eyebrow">Ageing Navigator</p>
        <h1 className="mt-2 text-[30px]">{doc.title}</h1>
        {doc.intro.map((p) => <p key={p} className="mt-3 text-[15.5px] text-muted">{p}</p>)}
        <div className="mt-5 rounded-lg bg-sand p-4 text-[14px]">{doc.notice}</div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary !min-h-[44px] !px-5" onClick={() => setStep(0)}>{restored ? "Continue where you left off" : "Start the questionnaire"}<ArrowRight size={16} aria-hidden="true" /></button>
          {restored && <button className="btn-outline" onClick={() => { setAnswers({}); setStep(0); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }}><RotateCcw size={15} aria-hidden="true" />Start again</button>}
        </div>
        <p className="mt-4 text-[13px] text-muted">Your answers stay in this browser until you submit them. Nothing is sent while you are filling it in.</p>
      </div>
    );
  }

  if (!current) return <p className="text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <div className="flex items-end justify-between gap-3 text-[13px] text-muted">
          <span>Section {Math.min(step + 1, sections.length)} of {sections.length}{current.conditional && <span className="ml-2 chip bg-brand-soft text-brand">Shown because of your answers</span>}</span>
          <span>{answered} of {total} questions</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Questionnaire progress">
          <div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        <h1 className="text-[24px]">{current.title}</h1>
        {current.intro && <p className="mt-2 rounded-lg bg-sand p-3 text-[14px]">{current.intro}</p>}

        <div className="mt-6 space-y-7">
          {current.questions.map((q) => <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} issue={issueFor(q.id)} />)}
        </div>

        {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-now-soft p-3 text-[14px] text-now"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" className="btn-ghost" onClick={() => { setStep((s) => Math.max(0, s - 1)); setIssues([]); window.scrollTo({ top: 0 }); }} disabled={step === 0}><ArrowLeft size={15} aria-hidden="true" />Back</button>
          <span className="flex items-center gap-1 text-[12.5px] text-muted"><Save size={14} aria-hidden="true" />Saved in this browser</span>
          <button className="btn-primary !min-h-[42px] !px-5" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : step + 1 === sections.length ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
            {step + 1 === sections.length ? "Finish and prepare my plan" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Question({ q, value, onChange, issue }: { q: QuestionDefinition; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void; issue?: string }) {
  const selected = Array.isArray(value) ? value : [];
  const atLimit = q.max !== undefined && selected.length >= q.max;
  const describedBy = [q.help ? `help-${q.id}` : "", issue ? `err-${q.id}` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset id={`q-${q.id}`} className="min-w-0">
      <legend className="text-[16px] font-semibold text-ink">{q.label}{q.optional && <span className="ml-2 text-[13px] font-normal text-muted">Optional</span>}</legend>
      {q.help && <p id={`help-${q.id}`} className="mt-1 text-[13.5px] text-muted">{q.help}</p>}
      {issue && <p id={`err-${q.id}`} role="alert" className="mt-1.5 text-[13.5px] font-semibold text-now">{issue}</p>}

      <div className={clsx("mt-3", q.type === "single" || q.type === "multi" ? "grid gap-2 sm:grid-cols-2" : "")}>
        {q.type === "single" && q.options.map((o) => (
          <label key={o.value} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[14.5px]", value === o.value ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40")}>
            <input type="radio" name={q.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 accent-brand" aria-describedby={describedBy} />
            <span>{o.label}</span>
          </label>
        ))}

        {q.type === "multi" && q.options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className={clsx("flex items-start gap-2.5 rounded-lg border p-3 text-[14.5px]", on ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40", !on && atLimit ? "cursor-not-allowed opacity-55" : "cursor-pointer")}>
              <input type="checkbox" checked={on} disabled={!on && atLimit} onChange={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])} className="mt-0.5 accent-brand" aria-describedby={describedBy} />
              <span>{o.label}</span>
            </label>
          );
        })}

        {q.type === "short" && <input className="field max-w-md" type={q.format === "email" ? "email" : "text"} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-label={q.label} />}
        {q.type === "long" && <textarea className="field" rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-label={q.label} />}

        {q.type === "tri_grid" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead><tr><th className="th">Document</th>{q.options.map((o) => <th key={o.value} className="th text-center">{o.label}</th>)}</tr></thead>
              <tbody>
                {q.items.map((item) => {
                  const rows = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string>;
                  return (
                    <tr key={item.id} className="border-t border-line">
                      <th scope="row" className="td text-[14px] font-semibold">{item.label}</th>
                      {q.options.map((o) => (
                        <td key={o.value} className="td text-center">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px]">
                            <input type="radio" name={`${q.id}-${item.id}`} checked={rows[item.id] === o.value} onChange={() => onChange({ ...rows, [item.id]: o.value })} className="accent-brand" />
                            <span className="sr-only sm:not-sr-only">{o.label}</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {q.max !== undefined && <p className="mt-1.5 text-[13px] text-muted">{selected.length} of {q.max} chosen</p>}
      {q.type === "multi" && !q.optional && !isAnswered(value) && <span className="sr-only">Select at least one option</span>}
    </fieldset>
  );
}
