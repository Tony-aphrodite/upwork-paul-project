"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, MessageSquare, Phone } from "lucide-react";
import type { ActionPlan, FamilyProfile, Priority } from "@/lib/schema";
import { PRIORITY_LABEL } from "@/lib/schema";
import { workspace } from "@/lib/workspace";

const GROUPS: [Priority, string, string][] = [
  ["now", "Do now", "Anything needing attention first, including safety issues and time-sensitive decisions."],
  ["soon", "Do next", "The most useful practical steps after the immediate priorities."],
  ["plan_ahead", "Plan ahead", "Worth putting in place before circumstances change."],
];
const PCLS: Record<Priority, string> = { now: "bg-now-soft text-now", soon: "bg-soon-soft text-soon", plan_ahead: "bg-ahead-soft text-ahead" };

export function PlanResult({ plan, profile, mapping, questionnaireVersion }: { plan: ActionPlan; profile: FamilyProfile; mapping: { inferred: string[]; notAsked: string[] }; questionnaireVersion: string }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const name = profile.person.preferredName || profile.person.firstName;

  // Demo behaviour: the plan joins the navigator's pilot queue in this browser. In production the family's submission
  // reaches the navigator through the server, and the family sees only their own copy.
  useEffect(() => {
    workspace.upsert({ planId: plan.planId, profile, versions: [plan], working: plan, source: "questionnaire", pilot: { status: "awaiting_review", submittedAt: new Date().toISOString() } });
  }, [plan, profile]);

  async function download(kind: "plan" | "summary") {
    setBusy(kind); setError("");
    try {
      const res = await fetch("/api/questionnaire/document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, plan, profile }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "The PDF could not be created.");
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `${plan.planId}-${kind === "plan" ? "family-action-plan" : "professional-summary"}.pdf` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Thank you</p>
        <h1 className="mt-2 text-[28px]">{name}&rsquo;s Family Ageing Action Plan is ready</h1>
        <p className="mt-2 text-muted">Prepared from the {plan.modules.length} topics that apply to your answers, with {plan.actions.length} practical steps. Your navigator reviews every plan in the pilot before it is sent, and may add local knowledge.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn-primary !min-h-[44px] !px-5" onClick={() => download("plan")} disabled={!!busy}>{busy === "plan" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}Download the full plan (PDF)</button>
          <button className="btn-outline !min-h-[44px] !px-5" onClick={() => download("summary")} disabled={!!busy}>{busy === "summary" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}One-page summary to share</button>
        </div>
        {error && <p role="alert" className="mt-3 text-[14px] text-now">{error}</p>}
        <p className="mt-4 text-[13px] text-muted">Plan {plan.planId}, version {plan.version}, from questionnaire {questionnaireVersion}. The one-page summary is the version to hand to a GP, hospital team, needs assessor or village.</p>
      </div>

      {plan.summary.urgent && (
        <section className="rounded-xl border-2 border-now bg-now-soft p-5" aria-labelledby="urgent-h">
          <h2 id="urgent-h" className="flex items-center gap-2 text-[19px] text-now"><AlertTriangle size={20} aria-hidden="true" />Things you told us may need urgent attention</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px]">{plan.summary.urgent.items.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="mt-3 flex items-start gap-2 text-[14px]"><Phone size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{plan.summary.urgent.guidance}</p>
          <p className="mt-2 text-[13px] text-muted">These are kept separate from the planning steps below on purpose.</p>
        </section>
      )}

      <section className="card p-6" aria-labelledby="sit-h">
        <h2 id="sit-h" className="text-[19px]">What you told us</h2>
        <ul className="mt-3 space-y-1.5 text-[15px]">{plan.summary.situation.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>

      {GROUPS.map(([level, title, blurb]) => {
        const actions = plan.actions.filter((a) => a.priority === level && a.status !== "no_longer_required");
        if (!actions.length) return null;
        return (
          <section key={level} className="card p-6" aria-labelledby={`g-${level}`}>
            <div className="flex flex-wrap items-center gap-2"><h2 id={`g-${level}`} className="text-[19px]">{title}</h2><span className={clsx("chip", PCLS[level])}>{PRIORITY_LABEL[level]}</span></div>
            <p className="mt-1 text-[14px] text-muted">{blurb}</p>
            <ol className="mt-4 space-y-3">
              {actions.map((a) => (
                <li key={a.key} className="rounded-lg border border-line p-4">
                  <p className="font-semibold">{a.title}</p>
                  <p className="mt-1 text-[14.5px] text-muted">{a.description}</p>
                  <p className="mt-2 text-[13px] text-muted">{a.timing} · for {a.responsible}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className="card p-6" aria-labelledby="who-h">
        <h2 id="who-h" className="text-[19px]">Who to contact</h2>
        {profile.network?.professionals.length ? <p className="mt-1 text-[14px] text-muted">You told us {profile.network.professionals.join(", ")} {profile.network.professionals.length === 1 ? "is" : "are"} already involved, so start with them where they fit.</p> : null}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[...new Set(plan.modules.flatMap((m) => m.whoCanHelp))].map((w) => <li key={w} className="rounded-lg bg-brand-soft px-3 py-2 text-[14.5px]">{w}</li>)}
        </ul>
      </section>

      <section className="card p-6" aria-labelledby="ask-h">
        <h2 id="ask-h" className="text-[19px]">Questions to ask</h2>
        <ul className="mt-3 space-y-2">
          {plan.modules.flatMap((m) => m.questions).slice(0, 12).map((q, i) => (
            <li key={i} className="text-[15px]"><span className="font-semibold">{q.for}:</span> {q.question}</li>
          ))}
        </ul>
      </section>

      {plan.providerMatches.length > 0 && (
        <section className="card p-6" aria-labelledby="opt-h">
          <h2 id="opt-h" className="text-[19px]">Options that may fit</h2>
          <p className="mt-1 text-[14px] text-muted">Each option lists why it was selected. Providers cannot pay to be ranked higher or shown as preferred.</p>
          <ul className="mt-4 space-y-3">
            {plan.providerMatches.map((m) => (
              <li key={`${m.moduleId}-${m.providerId}`} className="rounded-lg border border-line p-4">
                <p className="font-semibold">{m.name}</p>
                <ul className="mt-2 space-y-1 text-[14px]">
                  {m.matched.map((x) => <li key={x} className="flex items-start gap-1.5"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ahead" aria-hidden="true" />{x}</li>)}
                  {m.notMatched.map((x) => <li key={x} className="flex items-start gap-1.5 text-muted"><span aria-hidden="true" className="mt-0.5">✕</span>{x}</li>)}
                  {m.unknown.map((x) => <li key={x} className="flex items-start gap-1.5 text-muted"><span aria-hidden="true" className="mt-0.5">?</span>{x}</li>)}
                </ul>
                <p className="mt-2 text-[12.5px] text-muted">{m.verifiedOn ? `Information last verified on ${new Date(m.verifiedOn).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}.` : "We have not verified this information recently."}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Feedback planId={plan.planId} sent={feedbackSent} onSent={() => setFeedbackSent(true)} />

      <details className="card p-5">
        <summary className="cursor-pointer text-[15px] font-semibold">How your answers became this plan</summary>
        <p className="mt-3 text-[14px] text-muted">Your answers were mapped onto a structured Family Profile, and the topics below switched on by rule. Nothing was invented: where the questionnaire does not ask, the plan says so rather than assuming.</p>
        <ul className="mt-3 space-y-1 text-[13.5px]">
          {plan.modules.map((m) => <li key={m.id}><span className="font-semibold">{m.title}</span> <span className="text-muted">({PRIORITY_LABEL[m.priority].toLowerCase()})</span></li>)}
        </ul>
        {mapping.inferred.length > 0 && <p className="mt-3 text-[13px] text-muted">Worked out from other answers: {mapping.inferred.join("; ")}.</p>}
        {mapping.notAsked.length > 0 && <p className="mt-1 text-[13px] text-muted">Not asked in this questionnaire: {mapping.notAsked.join("; ")}.</p>}
      </details>
    </div>
  );
}

function Feedback({ planId, sent, onSent }: { planId: string; sent: boolean; onSent: () => void }) {
  const [useful, setUseful] = useState<"very" | "somewhat" | "not_really" | "">("");
  const [didSomething, setDidSomething] = useState(false);
  const [comment, setComment] = useState("");
  if (sent) return <p className="card p-5 text-[15px]"><CheckCircle2 size={16} className="mr-2 inline text-ahead" aria-hidden="true" />Thank you. Your feedback is with the pilot team.</p>;
  return (
    <form
      className="card p-6"
      onSubmit={(e) => { e.preventDefault(); if (!useful) return; workspace.setPilot(planId, { feedback: { useful, didSomething, comment, at: new Date().toISOString() } }); onSent(); }}
    >
      <h2 className="flex items-center gap-2 text-[19px]"><MessageSquare size={18} aria-hidden="true" />Two quick questions</h2>
      <p className="mt-1 text-[14px] text-muted">Ageing Navigator is being tested with a small number of families. Your answers help make the plans more useful for the next family.</p>
      <fieldset className="mt-4">
        <legend className="label">How useful is this plan?</legend>
        <div className="flex flex-wrap gap-2">
          {([["very", "Very useful"], ["somewhat", "Somewhat useful"], ["not_really", "Not really useful"]] as const).map(([v, l]) => (
            <label key={v} className={clsx("cursor-pointer rounded-lg border px-3 py-2 text-[14px]", useful === v ? "border-brand bg-brand-soft" : "border-line")}>
              <input type="radio" name="useful" className="mr-2 accent-brand" checked={useful === v} onChange={() => setUseful(v)} />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 flex items-center gap-2 text-[14.5px]"><input type="checkbox" className="accent-brand" checked={didSomething} onChange={(e) => setDidSomething(e.target.checked)} />We have already done something from the plan</label>
      <label className="mt-4 block"><span className="label">Anything missing or unclear? (optional)</span><textarea className="field" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      <button className="btn-primary mt-4" disabled={!useful}>Send feedback</button>
    </form>
  );
}
