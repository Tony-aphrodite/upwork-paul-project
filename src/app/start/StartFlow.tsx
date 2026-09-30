"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Answers, Questionnaire } from "@/lib/questionnaire/schema";
import { checkSection, cleanAnswers, progress, pruneAnswers, visibleSections, type Issue } from "@/lib/questionnaire/logic";
import { EMAIL_RE, cleanReferral, isPhone } from "@/lib/validate";
import { QuestionField } from "./QuestionField";
import { ContactStep, DoneStep, ErrorNote, Heading, IntroStep, StepNav, type Contact, type ContactIssues, type StartTexts } from "./steps";

const KEY = "an-questionnaire-draft-v2";
const EMPTY: Contact = { name: "", email: "", phone: "", firstName: "", preferredName: "" };
type Step = "intro" | { section: string } | "contact" | "done";
type Draft = { answers: Answers; sectionId?: string; referral?: string; submissionId?: string };
type Done = { reference: string; urgent: boolean; urgentGuidance?: string };

/** Server error paths such as "contact.email" mapped to the contact form's fields. */
const CONTACT_FIELD: Record<string, keyof Contact> = { "contact.name": "name", "contact.email": "email", "contact.phone": "phone", "person.firstName": "firstName", "person.preferredName": "preferredName" };

/**
 * The family's questionnaire: consent first, then only the sections that apply, then where to send the plan.
 * Answers (never contact details) are kept in this browser until they are sent, with the section reached, so the
 * questionnaire can be finished in two sittings; a draft from an older questionnaire keeps the answers that still fit.
 * After sending, the family is told the plan will be sent once a navigator has checked it.
 */
export function StartFlow({ doc, texts, draft }: { doc: Questionnaire; texts: StartTexts; draft: boolean }) {
  const [step, setStep] = useState<Step>("intro");
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
    const fromUrl = cleanReferral(new URLSearchParams(window.location.search).get("ref"));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Draft | null;
      const kept = saved ? cleanAnswers(doc, saved.answers ?? {}) : {};
      if (Object.keys(kept).length) { setAnswers(kept); setSavedSection(saved?.sectionId); setRestored(true); }
      setSubmissionId(saved?.submissionId);
      setReferral(fromUrl ?? saved?.referral);
    } catch { setReferral(fromUrl); }
  }, [doc]);

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
    go({ section: (resume ?? sections[0]).id });
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
    return (
      <IntroStep title={doc.title} intro={doc.intro} texts={texts} draft={draft} restored={restored} consent={consent} marketing={marketing} issue={contactIssues.consent}
        onConsent={(v) => { setConsent(v); setContactIssues({}); }} onMarketing={setMarketing} onStart={begin} onReset={reset} headingRef={heading} />
    );
  }

  const shownPercent = step === "contact" ? 100 : percent;
  const bar = (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3 text-[13px] text-muted">
        <span>{step === "contact" ? "Last step" : <>Section {index + 1} of {sections.length}</>}</span>
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

  return (
    <div className="mx-auto max-w-3xl">
      {bar}
      <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        <Heading ref={heading}>{current.title}</Heading>
        {current.intro && <p className="mt-2 rounded-lg bg-sand p-3 text-[14px]">{current.intro}</p>}
        <div className="mt-6 space-y-8">
          {current.questions.map((q) => <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} issue={issueFor(q.id)} />)}
        </div>
        {error && <ErrorNote text={error} />}
        <StepNav onBack={back} label="Continue" busy={busy} last={false} />
      </form>
    </div>
  );
}
