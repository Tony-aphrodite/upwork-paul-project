"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Answers, Questionnaire } from "@/lib/questionnaire/schema";
import { cardSection, checkSection, cleanAnswers, isAnswered, progress, pruneAnswers, questionIndex, visibleSections, type Issue } from "@/lib/questionnaire/logic";
import { EMAIL_RE, cleanReferral, isPhone } from "@/lib/validate";
import { QuestionField } from "./QuestionField";
import { ReasonCards } from "./ReasonCards";
import { ContactStep, DoneStep, ErrorNote, Heading, IntroStep, StepNav, type Contact, type ContactIssues, type StartTexts } from "./steps";

const KEY = "an-questionnaire-draft-v2";
const EMPTY: Contact = { name: "", email: "", phone: "", firstName: "", preferredName: "" };
type Step = "intro" | { section: string } | "contact" | "done";
type Draft = { answers: Answers; sectionId?: string; referral?: string; submissionId?: string };
type Done = { reference: string; urgent: boolean; urgentGuidance?: string };

/** Server error paths such as "contact.email" mapped to the contact form's fields. */
const CONTACT_FIELD: Record<string, keyof Contact> = { "contact.name": "name", "contact.email": "email", "contact.phone": "phone", "person.firstName": "firstName", "person.preferredName": "preferredName" };

/**
 * The family's questionnaire. When it opens with a card question ("What has brought you here?", as on the client's
 * website), the cards come first, then consent, then only the sections that apply, then where to send the plan.
 * Nothing leaves the browser before consent. Links from the client's website can answer the cards in advance
 * (/start?reason=dementia_diagnosis) and say the family is planning for themselves (/start?for=self).
 *
 * Answers (never contact details) are kept in this browser until they are sent, with the section reached, so the
 * questionnaire can be finished in two sittings; a draft from an older questionnaire keeps the answers that still fit.
 * After sending, the family is told the plan will be sent once a navigator has checked it.
 */
export function StartFlow({ doc, texts, draft }: { doc: Questionnaire; texts: StartTexts; draft: boolean }) {
  const cards = useMemo(() => cardSection(doc), [doc]);
  const [step, setStep] = useState<Step>(() => { const c = cardSection(doc); return c ? { section: c.section.id } : "intro"; });
  const [answers, setAnswers] = useState<Answers>({});
  const [savedSection, setSavedSection] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [referral, setReferral] = useState<string | undefined>();
  const [submissionId, setSubmissionId] = useState<string | undefined>();
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [honeypot, setHoneypot] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [contactIssues, setContactIssues] = useState<ContactIssues>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [restored, setRestored] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = cleanReferral(params.get("ref"));
    // Answers a link from the client's website brings in: the reason card, and "planning for myself".
    const given: Answers = {};
    const reason = params.get("reason");
    if (cards && reason && cards.question.options.some((o) => o.value === reason)) given[cards.question.id] = reason;
    if (params.get("for") === "self" && questionIndex(doc).get("q1")?.options.some((o) => o.value === "self")) given.q1 = "self";
    let kept: Answers = {};
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Draft | null;
      kept = saved ? cleanAnswers(doc, saved.answers ?? {}) : {};
      if (Object.keys(kept).length) { setSavedSection(saved?.sectionId); setRestored(true); }
      setSubmissionId(saved?.submissionId);
      setReferral(fromUrl ?? saved?.referral);
    } catch { setReferral(fromUrl); }
    const all = { ...kept, ...given };
    if (Object.keys(all).length) setAnswers(all);
    // With the reason already known (from the link or an earlier visit), the next step is consent.
    if (cards && isAnswered(all[cards.question.id])) setStep("intro");
  }, [doc, cards]);

  useEffect(() => {
    if (step === "intro" || step === "done") return;
    const d: Draft = { answers, sectionId: typeof step === "object" ? step.section : savedSection, referral, submissionId };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* a blocked store only means no draft */ }
  }, [answers, step, referral, submissionId, savedSection]);

  // After a step change, move focus to the new heading so screen readers announce it and the keyboard starts there.
  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const go = (s: Step) => { moved.current = true; setError(""); setStep(s); };

  const sections = useMemo(() => visibleSections(doc, answers), [doc, answers]);
  const index = typeof step === "object" ? sections.findIndex((s) => s.id === step.section) : -1;
  const current = index >= 0 ? sections[index] : undefined;
  const { percent } = progress(doc, answers);
  /** The card screen is the opening, not a numbered section. */
  const offset = cards ? 1 : 0;
  const self = answers.q1 === "self";

  const focusIssue = (id: string) => {
    const el = document.querySelector<HTMLElement>(`#q-${CSS.escape(id)} input, #q-${CSS.escape(id)} textarea`);
    el?.focus();
    el?.closest("fieldset")?.scrollIntoView({ block: "center" });
  };

  const set = (id: string, value: Answers[string]) => { setAnswers((prev) => ({ ...prev, [id]: value })); setIssues((prev) => prev.filter((i) => i.questionId !== id)); };

  const begin = () => {
    if (!consent) { setContactIssues({ consent: "Please tick the box to continue." }); return; }
    setContactIssues({});
    if (!submissionId) setSubmissionId(crypto.randomUUID());
    // Resume: the section reached last time if it still applies, else the first one with something missing.
    const firstGap = sections.find((s) => checkSection(s, answers).length);
    const resume = restored ? sections.find((s) => s.id === savedSection) ?? firstGap : undefined;
    if (restored && !resume) return go("contact");
    const opened = cards && isAnswered(answers[cards.question.id]);
    const first = resume ?? (opened ? sections[1] : sections[0]);
    go(first ? { section: first.id } : "contact");
  };

  /** A reason card: record it, then consent (the first time) or straight on to the questions. */
  const pick = (value: string) => {
    if (!cards) return;
    const chosen = { ...answers, [cards.question.id]: value };
    setAnswers(chosen); setIssues([]);
    if (!consent) return go("intro");
    const after = visibleSections(doc, chosen);
    go(after.length > 1 ? { section: after[1].id } : "contact");
  };

  const next = () => {
    if (!current) return;
    const found = checkSection(current, answers);
    setIssues(found);
    if (found.length) { focusIssue(found[0].questionId); return; }
    const pruned = pruneAnswers(doc, answers);
    setAnswers(pruned);
    const after = visibleSections(doc, pruned);
    const at = after.findIndex((s) => s.id === current.id);
    go(at + 1 < after.length ? { section: after[at + 1].id } : "contact");
  };

  const back = () => {
    setIssues([]);
    if (step === "contact") return go(sections.length ? { section: sections[sections.length - 1].id } : "intro");
    go(index > 0 ? { section: sections[index - 1].id } : "intro");
  };

  const reset = () => {
    setAnswers({}); setRestored(false); setSavedSection(undefined); setSubmissionId(undefined);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  };

  async function submit() {
    const person = self ? { firstName: contact.name.trim().split(/\s+/)[0] ?? "", preferredName: "" } : { firstName: contact.firstName, preferredName: contact.preferredName };
    const found: ContactIssues = {};
    if (!contact.name.trim()) found.name = "Please tell us your name.";
    if (!EMAIL_RE.test(contact.email.trim())) found.email = "Please check this email address.";
    if (contact.phone.trim() && !isPhone(contact.phone)) found.phone = "Please check this phone number (numbers only, at least six digits).";
    if (!self && !contact.firstName.trim()) found.firstName = "Please give their first name.";
    setContactIssues(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) { document.getElementById(`c-${firstBad}`)?.focus(); return; }

    setBusy(true); setError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId, questionnaireVersion: doc.version, answers: pruneAnswers(doc, answers),
          contact: { name: contact.name, email: contact.email, phone: contact.phone }, person, consent, marketingConsent: marketing, referral, an_hp: honeypot,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = (json.details ?? []) as { path: string; message: string }[];
        const fields: ContactIssues = {};
        for (const d of details) if (CONTACT_FIELD[d.path]) fields[CONTACT_FIELD[d.path]] = d.message;
        setContactIssues(fields);
        const qIssues = details.filter((d) => !d.path.includes(".")).map((d) => ({ questionId: d.path, message: d.message }));
        const target = qIssues.length ? sections.find((s) => s.questions.some((q) => q.id === qIssues[0].questionId)) : undefined;
        if (target) { setIssues(qIssues); go({ section: target.id }); }
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(json as Done);
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      go("done");
    } catch {
      setError("We could not reach Ageing Navigator. Your answers are still saved in this browser, so you can try again.");
    } finally { setBusy(false); }
  }

  if (step === "done" && done) return <DoneStep reference={done.reference} thankYou={texts.thankYou} urgentGuidance={done.urgent ? done.urgentGuidance : undefined} headingRef={heading} />;

  if (step === "intro") {
    const reason = cards ? cards.question.options.find((o) => o.value === answers[cards.question.id])?.label : undefined;
    return (
      <IntroStep title={doc.title} intro={doc.intro} texts={texts} draft={draft} restored={restored} consent={consent} marketing={marketing} issue={contactIssues.consent}
        reason={reason} onChangeReason={cards ? () => go({ section: cards.section.id }) : undefined}
        onConsent={(v) => { setConsent(v); setContactIssues({}); }} onMarketing={setMarketing} onStart={begin} onReset={reset} headingRef={heading} />
    );
  }

  const shownPercent = step === "contact" ? 100 : percent;
  const bar = (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3 text-[15px] text-muted">
        <span>{step === "contact" ? "Last step" : <>Section {index + 1 - offset} of {sections.length - offset}</>}</span>
        <span>{shownPercent}% done</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={shownPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Questionnaire progress">
        <div className="h-full bg-brand transition-all" style={{ width: `${shownPercent}%` }} />
      </div>
    </div>
  );

  if (step === "contact") {
    return (
      <div className="mx-auto max-w-3xl">
        {bar}
        <ContactStep contact={contact} issues={contactIssues} self={self} honeypot={honeypot} error={error} busy={busy} intro={texts.contactIntro}
          onChange={(key, v) => { setContact({ ...contact, [key]: v }); setContactIssues((x) => ({ ...x, [key]: undefined })); }}
          onHoneypot={setHoneypot} onSubmit={() => void submit()} onBack={back} headingRef={heading} />
      </div>
    );
  }

  if (!current) return <p className="text-muted">Loading…</p>;
  const issueFor = (id: string) => issues.find((i) => i.questionId === id)?.message;

  if (cards && current.id === cards.section.id) {
    const chosen = answers[cards.question.id];
    return (
      <div className="mx-auto max-w-6xl">
        {draft && <p className="mb-5 rounded-lg bg-soon-soft p-3 text-[16px] text-soon"><strong>Test version.</strong> The questions and wording are drafts that Ageing Navigator has not yet approved.</p>}
        <Heading ref={heading} className="text-[clamp(1.9rem,4.6vw,2.75rem)] font-bold leading-tight outline-none">{current.title}</Heading>
        {current.intro && <p className="mt-3 max-w-2xl text-[18px] text-muted">{current.intro}</p>}
        <div className="mt-8"><ReasonCards q={cards.question} value={typeof chosen === "string" ? chosen : undefined} onPick={pick} /></div>
        <p className="mt-6 text-[15px] text-muted">Your answers stay in this browser until you send them at the end.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {bar}
      <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        <Heading ref={heading}>{current.title}</Heading>
        {current.intro && <p className="mt-2 rounded-lg bg-sand p-3 text-[16.5px]">{current.intro}</p>}
        <div className="mt-6 space-y-8">
          {current.questions.map((q) => <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} issue={issueFor(q.id)} />)}
        </div>
        {error && <ErrorNote text={error} />}
        <StepNav onBack={back} label="Continue" busy={busy} last={false} />
      </form>
    </div>
  );
}
