"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Loader2 } from "lucide-react";

const USEFUL = [["very", "Very useful"], ["somewhat", "Somewhat useful"], ["not_really", "Not really useful"]] as const;
const SENSE = [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]] as const;

/** The pilot's feedback questions for the free plan (build brief section 41). */
export function FeedbackForm({ token, given }: { token: string; given: boolean }) {
  const [useful, setUseful] = useState("");
  const [madeSense, setMadeSense] = useState("");
  const [missing, setMissing] = useState("");
  const [confusing, setConfusing] = useState("");
  const [wantsHelp, setWantsHelp] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "sent">(given ? "sent" : "idle");
  const [error, setError] = useState("");

  if (state === "sent") return <p role="status" className="mt-4 flex items-start gap-2 text-[15px] text-ahead"><CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Thank you for your feedback.</p>;

  const choice = (name: string, items: readonly (readonly [string, string])[], value: string, set: (v: string) => void, legend: string) => (
    <fieldset>
      <legend className="label !text-[15px]">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map(([v, l]) => (
          <label key={v} className={clsx("cursor-pointer rounded-lg border px-3 py-2 text-[15px]", value === v ? "border-brand bg-brand-soft" : "border-line")}>
            <input type="radio" name={name} className="mr-2 accent-brand" checked={value === v} onChange={() => set(v)} />{l}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const send = async () => {
    if (!useful || !madeSense) { setError("Please answer the first two questions."); return; }
    setState("busy"); setError("");
    const res = await fetch(`/api/p/${token}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useful, madeSense, missing, confusing, wantsHelp }) }).catch(() => null);
    if (res?.ok) setState("sent");
    else { setState("idle"); setError("We could not send this. Please try again."); }
  };

  return (
    <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      {choice("useful", USEFUL, useful, setUseful, "How useful was the plan?")}
      {choice("sense", SENSE, madeSense, setMadeSense, "Did the recommendations make sense?")}
      <div><label htmlFor="fb-missing" className="label !text-[15px]">Was anything important missing? (optional)</label><textarea id="fb-missing" rows={2} maxLength={2000} className="field !text-[15px]" value={missing} onChange={(e) => setMissing(e.target.value)} /></div>
      <div><label htmlFor="fb-confusing" className="label !text-[15px]">Was anything confusing or incorrect? (optional)</label><textarea id="fb-confusing" rows={2} maxLength={2000} className="field !text-[15px]" value={confusing} onChange={(e) => setConfusing(e.target.value)} /></div>
      <label className="flex cursor-pointer items-start gap-2.5 text-[15px]"><input type="checkbox" className="mt-1 accent-brand" checked={wantsHelp} onChange={(e) => setWantsHelp(e.target.checked)} />I would like Ageing Navigator to organise some of the next steps.</label>
      {error && <p role="alert" className="text-[14px] font-semibold text-now">{error}</p>}
      <button className="btn-outline !min-h-[44px] !px-5" disabled={state === "busy"}>{state === "busy" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Send feedback</button>
    </form>
  );
}
