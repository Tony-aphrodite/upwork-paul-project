"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { Answers, QuestionDefinition, Questionnaire } from "@/lib/questionnaire/schema";
import { checkSection, isAnswered, progress, pruneAnswers, visibleSections, type Issue } from "@/lib/questionnaire/logic";
import { cleanReferral } from "@/lib/validate";

const KEY = "an-questionnaire-draft-v1";
type Texts = { consent: string; marketing: string; thankYou: string; notice: string };
type Contact = { name: string; email: string; phone: string; firstName: string; preferredName: string };
type Done = { reference: string; urgent: boolean; urgentGuidance?: string };
type Step = "intro" | number | "contact";

const EMPTY: Contact = { name: "", email: "", phone: "", firstName: "", preferredName: "" };
const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/**
 * The family's questionnaire: consent first, then only the sections that apply, then where to send the plan.
 * Answers (never contact details) are kept in this browser until they are submitted, so the questionnaire can be
 * finished in two sittings. After submitting, the family is told the plan will be sent once a navigator has checked it.
 */
export function StartFlow({ doc, texts, draft }: { doc: Questionnaire; texts: Texts; draft: boolean }) {
  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [referral, setReferral] = useState<string | undefined>();
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [website, setWebsite] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [contactIssues, setContactIssues] = useState<Partial<Record<keyof Contact | "consent", string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const fromUrl = cleanReferral(new URLSearchParams(window.location.search).get("ref"));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { answers: Answers; step: Step; version: string; referral?: string } | null;
      if (saved?.version === doc.version && Object.keys(saved.answers ?? {}).length) { setAnswers(saved.answers); setRestored(true); }
      setReferral(fromUrl ?? saved?.referral);
    } catch { setReferral(fromUrl); }
  }, [doc.version]);

  useEffect(() => {
    if (step === "intro" || done) return;
    try { localStorage.setItem(KEY, JSON.stringify({ answers, step, version: doc.version, referral })); } catch { /* a blocked store only means no draft */ }
  }, [answers, step, doc.version, referral, done]);

  const sections = useMemo(() => visibleSections(doc, answers), [doc, answers]);
  const index = typeof step === "number" ? Math.min(step, sections.length - 1) : -1;
  const current = index >= 0 ? sections[index] : undefined;
  const { percent } = progress(doc, answers);
  const top = () => window.scrollTo({ top: 0 });
  const self = answers.q1 === "self";

  const set = (id: string, value: Answers[string]) => { setAnswers((prev) => ({ ...prev, [id]: value })); setIssues((prev) => prev.filter((i) => i.questionId !== id)); };

  const begin = () => {
    if (!consent) { setContactIssues({ consent: "Please tick the box to continue." }); return; }
    setContactIssues({});
    setStep(0); top();
  };

  const next = () => {
    if (!current) return;
    const found = checkSection(current, answers);
    setIssues(found);
    if (found.length) { document.getElementById(`q-${found[0].questionId}`)?.scrollIntoView({ block: "center" }); return; }
    const pruned = pruneAnswers(doc, answers);
    setAnswers(pruned);
    const after = visibleSections(doc, pruned);
    const at = after.findIndex((s) => s.id === current.id);
    setStep(at + 1 < after.length ? at + 1 : "contact"); top();
  };

  const back = () => { setIssues([]); setStep(step === "contact" ? sections.length - 1 : typeof step === "number" && step > 0 ? step - 1 : "intro"); top(); };

  async function submit() {
    const person = self ? { firstName: contact.name.trim().split(/\s+/)[0] ?? "", preferredName: "" } : { firstName: contact.firstName, preferredName: contact.preferredName };
    const found: typeof contactIssues = {};
    if (!contact.name.trim()) found.name = "Please tell us your name.";
    if (!EMAIL.test(contact.email.trim())) found.email = "Please check this email address.";
    if (contact.phone && !/^[0-9 +()-]{6,}$/.test(contact.phone.trim())) found.phone = "Use numbers only.";
    if (!self && !contact.firstName.trim()) found.firstName = "Please give their first name.";
    setContactIssues(found);
    if (Object.keys(found).length) return;

    setBusy(true); setError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: pruneAnswers(doc, answers), contact: { name: contact.name, email: contact.email, phone: contact.phone }, person, consent, marketingConsent: marketing, referral, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = (json.details ?? []) as { path: string; message: string }[];
        const qIssues = details.filter((d) => !d.path.includes(".")).map((d) => ({ questionId: d.path, message: d.message }));
        if (qIssues.length) {
          const at = sections.findIndex((s) => s.questions.some((q) => q.id === qIssues[0].questionId));
          if (at >= 0) { setIssues(qIssues); setStep(at); top(); }
        }
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(json as Done);
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      top();
    } catch {
      setError("We could not reach Ageing Navigator. Your answers are still saved in this browser, so you can try again.");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {done.urgent && done.urgentGuidance && (
          <div role="alert" className="rounded-xl border-4 border-now bg-white p-5">
            <p className="flex items-center gap-2 text-[18px] font-bold text-now"><AlertTriangle size={20} aria-hidden="true" />Something may need urgent attention</p>
            <p className="mt-2 text-[16px] font-semibold">{done.urgentGuidance}</p>
          </div>
        )}
        <div className="card p-6 sm:p-8">
          <CheckCircle2 size={30} className="text-ahead" aria-hidden="true" />
          <h1 className="mt-3 text-[26px]">Your answers have been sent</h1>
          <p className="mt-3 text-[16px]">{texts.thankYou}</p>
          <p className="mt-4 text-[14px] text-muted">Your reference is <strong className="font-mono text-ink">{done.reference}</strong>. Please quote it if you contact us.</p>
        </div>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div className="card mx-auto max-w-3xl p-6 sm:p-8">
        {draft && <DraftNote />}
        <p className="eyebrow">Ageing Navigator</p>
        <h1 className="mt-2 text-[28px] sm:text-[30px]">{doc.title}</h1>
        {doc.intro.map((p) => <p key={p} className="mt-3 text-[15.5px] text-muted">{p}</p>)}
        <div className="mt-6 rounded-lg border border-line bg-sand p-4">
          <p className="text-[14.5px]">{texts.consent}</p>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[15px] font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={consent} onChange={(e) => { setConsent(e.target.checked); setContactIssues({}); }} aria-describedby={contactIssues.consent ? "consent-err" : undefined} />
            I agree, and I have the older person&rsquo;s agreement or am acting in their interests.
          </label>
          {contactIssues.consent && <p id="consent-err" role="alert" className="mt-1.5 text-[13.5px] font-semibold text-now">{contactIssues.consent}</p>}
          {texts.marketing && (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[14px] text-muted">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />{texts.marketing}
            </label>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary !min-h-[46px] !px-5 !text-[15px]" onClick={begin}>{restored ? "Continue where you left off" : "Start"}<ArrowRight size={16} aria-hidden="true" /></button>
          {restored && <button className="btn-outline !min-h-[46px]" onClick={() => { setAnswers({}); setRestored(false); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }}><RotateCcw size={15} aria-hidden="true" />Start again</button>}
        </div>
        <p className="mt-4 text-[13px] text-muted">Your answers are kept in this browser until you send them. On a shared computer, use &ldquo;Start again&rdquo; to clear them.</p>
      </div>
    );
  }

  const bar = (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3 text-[13px] text-muted">
        <span>{step === "contact" ? "Last step" : <>Section {index + 1} of {sections.length}</>}</span>
        <span>{step === "contact" ? 100 : percent}% done</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={step === "contact" ? 100 : percent} aria-valuemin={0} aria-valuemax={100} aria-label="Questionnaire progress">
        <div className="h-full bg-brand transition-all" style={{ width: `${step === "contact" ? 100 : percent}%` }} />
      </div>
    </div>
  );

  const nav = (label: string, onNext: () => void) => (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <button type="button" className="btn-ghost" onClick={back}><ArrowLeft size={15} aria-hidden="true" />Back</button>
      <button type="button" className="btn-primary !min-h-[44px] !px-5" disabled={busy} onClick={onNext}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : step === "contact" ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}{label}
      </button>
    </div>
  );

  if (step === "contact") {
    const field = (key: keyof Contact, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
      <div>
        <label htmlFor={`c-${key}`} className="label !text-[15px]">{label}</label>
        {hint && <p id={`c-${key}-hint`} className="-mt-0.5 mb-1.5 text-[13px] text-muted">{hint}</p>}
        <input id={`c-${key}`} className="field max-w-md !text-[15px]" value={contact[key]} onChange={(e) => { setContact({ ...contact, [key]: e.target.value }); setContactIssues((x) => ({ ...x, [key]: undefined })); }}
          aria-invalid={!!contactIssues[key]} aria-describedby={[hint ? `c-${key}-hint` : "", contactIssues[key] ? `c-${key}-err` : ""].filter(Boolean).join(" ") || undefined} {...props} />
        {contactIssues[key] && <p id={`c-${key}-err`} role="alert" className="mt-1 text-[13.5px] font-semibold text-now">{contactIssues[key]}</p>}
      </div>
    );
    return (
      <div className="mx-auto max-w-3xl">
        {bar}
        <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          <h1 className="text-[24px]">Where should we send the plan?</h1>
          <p className="mt-2 text-[14.5px] text-muted">We only use these details to send the plan and to contact you about it.</p>
          <div className="mt-6 space-y-5">
            {field("name", "Your name", { autoComplete: "name" })}
            {field("email", "Your email address", { type: "email", autoComplete: "email", inputMode: "email" }, "We email you a private link to the plan once it has been checked.")}
            {field("phone", "Your phone number (optional)", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
            {!self && field("firstName", "The older person's first name", {}, "Used to personalise the plan.")}
            {!self && field("preferredName", "What do they like to be called? (optional)")}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="website">Leave this empty</label><input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-now-soft p-3 text-[14px] text-now"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
          {nav("Send my answers", () => void submit())}
        </form>
      </div>
    );
  }

  if (!current) return <p className="text-muted">Loading…</p>;
  const issueFor = (id: string) => issues.find((i) => i.questionId === id)?.message;

  return (
    <div className="mx-auto max-w-3xl">
      {bar}
      <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        <h1 className="text-[24px]">{current.title}</h1>
        {current.intro && <p className="mt-2 rounded-lg bg-sand p-3 text-[14px]">{current.intro}</p>}
        <div className="mt-6 space-y-8">
          {current.questions.map((q) => <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} issue={issueFor(q.id)} />)}
        </div>
        {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-now-soft p-3 text-[14px] text-now"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
        {nav("Continue", next)}
      </form>
    </div>
  );
}

function DraftNote() {
  return <p className="mb-4 rounded-lg bg-soon-soft p-3 text-[13.5px] text-soon"><strong>Test version.</strong> The questions and wording are drafts that Ageing Navigator has not yet approved.</p>;
}

function Question({ q, value, onChange, issue }: { q: QuestionDefinition; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void; issue?: string }) {
  const selected = Array.isArray(value) ? value : [];
  const atLimit = q.max !== undefined && selected.length >= q.max;
  const describedBy = [q.help ? `help-${q.id}` : "", issue ? `err-${q.id}` : ""].filter(Boolean).join(" ") || undefined;
  const toggle = (v: string, exclusive?: boolean) => {
    if (selected.includes(v)) return onChange(selected.filter((x) => x !== v));
    if (exclusive) return onChange([v]);
    const exclusives = new Set(q.options.filter((o) => o.exclusive).map((o) => o.value));
    onChange([...selected.filter((x) => !exclusives.has(x)), v]);
  };
  const option = "flex items-start gap-2.5 rounded-lg border p-3 text-[15px] leading-snug";

  return (
    <fieldset id={`q-${q.id}`} className="min-w-0 scroll-mt-24" aria-describedby={describedBy}>
      <legend className="text-[16.5px] font-semibold text-ink">{q.label}{q.optional && <span className="ml-2 text-[13px] font-normal text-muted">Optional</span>}</legend>
      {q.help && <p id={`help-${q.id}`} className="mt-1 text-[13.5px] text-muted">{q.help}</p>}
      {issue && <p id={`err-${q.id}`} role="alert" className="mt-1.5 text-[13.5px] font-semibold text-now">{issue}</p>}

      <div className={clsx("mt-3", (q.type === "single" || q.type === "multi") && "grid gap-2 sm:grid-cols-2")}>
        {q.type === "single" && q.options.map((o) => (
          <label key={o.value} className={clsx(option, "cursor-pointer", value === o.value ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40")}>
            <input type="radio" name={q.id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 accent-brand" />
            <span>{o.label}</span>
          </label>
        ))}
        {q.type === "multi" && q.options.map((o) => {
          const on = selected.includes(o.value);
          const blocked = !on && atLimit && !o.exclusive;
          return (
            <label key={o.value} className={clsx(option, on ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand/40", blocked ? "cursor-not-allowed opacity-55" : "cursor-pointer")}>
              <input type="checkbox" value={o.value} checked={on} disabled={blocked} onChange={() => toggle(o.value, o.exclusive)} className="mt-1 accent-brand" />
              <span>{o.label}</span>
            </label>
          );
        })}
        {q.type === "short" && <input className="field max-w-md !text-[15px]" maxLength={200} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />}
        {q.type === "long" && <textarea className="field !text-[15px]" rows={4} maxLength={2000} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />}
        {q.type === "tri_grid" && (
          <div className="space-y-3">
            {q.items.map((item) => {
              const rows = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string>;
              return (
                <div key={item.id} role="radiogroup" aria-label={item.label} className="rounded-lg border border-line bg-white p-3">
                  <p className="text-[15px] font-semibold">{item.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <label key={o.value} className={clsx("cursor-pointer rounded-lg border px-3 py-1.5 text-[14.5px]", rows[item.id] === o.value ? "border-brand bg-brand-soft" : "border-line")}>
                        <input type="radio" className="mr-2 accent-brand" name={`${q.id}-${item.id}`} value={o.value} checked={rows[item.id] === o.value} onChange={() => onChange({ ...rows, [item.id]: o.value })} />{o.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {q.max !== undefined && <p className="mt-1.5 text-[13px] text-muted">{selected.length} of {q.max} chosen</p>}
      {q.type === "multi" && !q.optional && !isAnswered(value) && <span className="sr-only">Select at least one option</span>}
    </fieldset>
  );
}
