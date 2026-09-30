"use client";

import { forwardRef } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { LIMITS } from "@/lib/validate";

/** The steps around the questions: introduction with consent, contact details, and the thank-you page. */

export type StartTexts = { consent: string; consentCheckbox: string; marketing: string; thankYou: string; contactIntro: string };
export type Contact = { name: string; email: string; phone: string; firstName: string; preferredName: string };
export type ContactIssues = Partial<Record<keyof Contact | "consent", string>>;

export const Heading = forwardRef<HTMLHeadingElement, { children: React.ReactNode; className?: string }>(function Heading({ children, className }, ref) {
  return <h1 ref={ref} tabIndex={-1} className={className ?? "text-[24px] outline-none"}>{children}</h1>;
});

export function ErrorNote({ text }: { text: string }) {
  return <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-now-soft p-3 text-[14px] text-now"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text}</p>;
}

export function StepNav({ onBack, label, busy, last }: { onBack: () => void; label: string; busy: boolean; last: boolean }) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <button type="button" className="btn-ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Back</button>
      <button type="submit" className="btn-primary !min-h-[44px] !px-5" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : last ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}{label}
      </button>
    </div>
  );
}

export function IntroStep(props: {
  title: string; intro: string[]; texts: StartTexts; draft: boolean; restored: boolean;
  consent: boolean; marketing: boolean; issue?: string;
  onConsent: (v: boolean) => void; onMarketing: (v: boolean) => void; onStart: () => void; onReset: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const { texts } = props;
  return (
    <form className="card mx-auto max-w-3xl p-6 sm:p-8" onSubmit={(e) => { e.preventDefault(); props.onStart(); }} noValidate>
      {props.draft && <p className="mb-4 rounded-lg bg-soon-soft p-3 text-[13.5px] text-soon"><strong>Test version.</strong> The questions and wording are drafts that Ageing Navigator has not yet approved.</p>}
      <p className="eyebrow">Ageing Navigator</p>
      <Heading ref={props.headingRef} className="mt-2 text-[28px] outline-none sm:text-[30px]">{props.title}</Heading>
      {props.intro.map((p) => <p key={p} className="mt-3 text-[15.5px] text-muted">{p}</p>)}
      <div className="mt-6 rounded-lg border border-line bg-sand p-4">
        <p className="text-[14.5px]">{texts.consent}</p>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[15px] font-semibold">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={props.consent} onChange={(e) => props.onConsent(e.target.checked)} aria-invalid={!!props.issue} aria-describedby={props.issue ? "consent-err" : undefined} />
          {texts.consentCheckbox}
        </label>
        {props.issue && <p id="consent-err" role="alert" className="mt-1.5 text-[13.5px] font-semibold text-now">{props.issue}</p>}
        {texts.marketing && (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[14px] text-muted">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={props.marketing} onChange={(e) => props.onMarketing(e.target.checked)} />{texts.marketing}
          </label>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" className="btn-primary !min-h-[46px] !px-5 !text-[15px]">{props.restored ? "Continue where you left off" : "Start"}<ArrowRight size={16} aria-hidden="true" /></button>
        {props.restored && <button type="button" className="btn-outline !min-h-[46px]" onClick={props.onReset}><RotateCcw size={15} aria-hidden="true" />Start again</button>}
      </div>
      <p className="mt-4 text-[13px] text-muted">Your answers are kept in this browser until you send them. On a shared computer, use &ldquo;Start again&rdquo; to clear them.</p>
    </form>
  );
}

export function ContactStep(props: {
  contact: Contact; issues: ContactIssues; self: boolean; honeypot: string; error: string; busy: boolean; intro: string;
  onChange: (key: keyof Contact, v: string) => void; onHoneypot: (v: string) => void; onSubmit: () => void; onBack: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const field = (key: keyof Contact, label: string, max: number, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`c-${key}`} className="label !text-[15px]">{label}</label>
      {hint && <p id={`c-${key}-hint`} className="-mt-0.5 mb-1.5 text-[13px] text-muted">{hint}</p>}
      <input id={`c-${key}`} className="field max-w-md !text-[15px]" maxLength={max} value={props.contact[key]} onChange={(e) => props.onChange(key, e.target.value)}
        aria-invalid={!!props.issues[key]} aria-describedby={[hint ? `c-${key}-hint` : "", props.issues[key] ? `c-${key}-err` : ""].filter(Boolean).join(" ") || undefined} {...extra} />
      {props.issues[key] && <p id={`c-${key}-err`} role="alert" className="mt-1 text-[13.5px] font-semibold text-now">{props.issues[key]}</p>}
    </div>
  );
  return (
    <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); props.onSubmit(); }} noValidate>
      <Heading ref={props.headingRef}>Where should we send the plan?</Heading>
      <p className="mt-2 text-[14.5px] text-muted">{props.intro}</p>
      <div className="mt-6 space-y-5">
        {field("name", "Your name", LIMITS.name, { autoComplete: "name" })}
        {field("email", "Your email address", LIMITS.email, { type: "email", autoComplete: "email", inputMode: "email" }, "We email you a private link to the plan once it has been checked.")}
        {field("phone", "Your phone number (optional)", LIMITS.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
        {!props.self && field("firstName", "The older person's first name", LIMITS.firstName, { autoComplete: "off" }, "Used to personalise the plan.")}
        {!props.self && field("preferredName", "What do they like to be called? (optional)", LIMITS.firstName, { autoComplete: "off" })}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="an-hp">Leave this empty</label><input id="an-hp" name="an_hp" tabIndex={-1} autoComplete="off" value={props.honeypot} onChange={(e) => props.onHoneypot(e.target.value)} />
        </div>
      </div>
      {props.error && <ErrorNote text={props.error} />}
      <StepNav onBack={props.onBack} label="Send my answers" busy={props.busy} last />
    </form>
  );
}

export function DoneStep({ reference, thankYou, urgentGuidance, headingRef }: { reference: string; thankYou: string; urgentGuidance?: string; headingRef: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {urgentGuidance && (
        <div role="alert" className="rounded-xl border-4 border-now bg-white p-5">
          <p className="flex items-center gap-2 text-[18px] font-bold text-now"><AlertTriangle size={20} aria-hidden="true" />Something may need urgent attention</p>
          <p className="mt-2 text-[16px] font-semibold">{urgentGuidance}</p>
        </div>
      )}
      <div className="card p-6 sm:p-8">
        <CheckCircle2 size={30} className="text-ahead" aria-hidden="true" />
        <Heading ref={headingRef} className="mt-3 text-[26px] outline-none">Your answers have been sent</Heading>
        <p className="mt-3 text-[16px]">{thankYou}</p>
        <p className="mt-4 text-[14px] text-muted">Your reference is <strong className="font-mono text-ink">{reference}</strong>. Please quote it if you contact us.</p>
      </div>
    </div>
  );
}
