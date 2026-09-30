"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Loader2 } from "lucide-react";

type Service = { id: string; label: string; suggested: boolean };

export function RequestForm({ token, services }: { token: string; services: Service[] }) {
  const [chosen, setChosen] = useState<string[]>(services.filter((s) => s.suggested).map((s) => s.id));
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  if (state === "sent") return <p role="status" className="mt-5 flex items-start gap-2 rounded-lg bg-ahead-soft p-4 text-[15px] text-ahead"><CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Thank you. A navigator will contact you to talk it through.</p>;

  const send = async () => {
    setError("");
    if (method === "phone" && phone.replace(/\D/g, "").length < 6) { setError("Please give a phone number, or choose email."); return; }
    setState("busy");
    const res = await fetch(`/api/p/${token}/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ services: chosen, contactMethod: method, phone, bestTime, message }) }).catch(() => null);
    if (res?.ok) { setState("sent"); return; }
    setState("idle");
    setError((await res?.json().catch(() => null))?.error ?? "We could not send this. Please try again.");
  };

  return (
    <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <fieldset>
        <legend className="label !text-[15px]">What would you like help with?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => {
            const on = chosen.includes(s.id);
            return (
              <label key={s.id} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[15px]", on ? "border-brand bg-brand-soft" : "border-line bg-white")}>
                <input type="checkbox" className="mt-1 accent-brand" checked={on} onChange={() => setChosen(on ? chosen.filter((x) => x !== s.id) : [...chosen, s.id])} />{s.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label !text-[15px]">How should we contact you?</legend>
        <div className="flex flex-wrap gap-2">
          {(["phone", "email"] as const).map((m) => (
            <label key={m} className={clsx("cursor-pointer rounded-lg border px-3 py-2 text-[15px]", method === m ? "border-brand bg-brand-soft" : "border-line")}>
              <input type="radio" name="method" className="mr-2 accent-brand" checked={method === m} onChange={() => setMethod(m)} />{m === "phone" ? "Phone" : "Email (the address this plan was sent to)"}
            </label>
          ))}
        </div>
      </fieldset>
      {method === "phone" && <div><label htmlFor="rq-phone" className="label !text-[15px]">Phone number</label><input id="rq-phone" type="tel" inputMode="tel" autoComplete="tel" className="field max-w-xs !text-[15px]" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>}
      <div><label htmlFor="rq-time" className="label !text-[15px]">Best time to reach you (optional)</label><input id="rq-time" className="field max-w-md !text-[15px]" maxLength={200} value={bestTime} onChange={(e) => setBestTime(e.target.value)} /></div>
      <div><label htmlFor="rq-msg" className="label !text-[15px]">Anything we should know first? (optional)</label><textarea id="rq-msg" rows={3} maxLength={2000} className="field !text-[15px]" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
      {error && <p role="alert" className="text-[14px] font-semibold text-now">{error}</p>}
      <button className="btn-primary !min-h-[44px] !px-5" disabled={state === "busy"}>{state === "busy" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Ask Ageing Navigator for help</button>
    </form>
  );
}
