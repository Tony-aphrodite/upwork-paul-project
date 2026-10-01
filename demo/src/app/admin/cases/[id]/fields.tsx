"use client";

import { useId, useState } from "react";
import clsx from "clsx";

/** Small editing controls for the review screen. */

export function Box({ title, tone, children }: { title: string; tone?: "now"; children: React.ReactNode }) {
  return <section className={clsx("card p-4 sm:p-5", tone === "now" && "border-now")}><h2 className={clsx("mb-3 text-[17px]", tone === "now" && "text-now")}>{title}</h2><div className="grid gap-3">{children}</div></section>;
}

export function Input({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return <div><label htmlFor={id} className="label">{label}</label><input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

export function TextArea({ value, onChange, label, rows = 2 }: { value: string; onChange: (v: string) => void; label: string; rows?: number }) {
  const id = useId();
  return <div><label htmlFor={id} className="label">{label}</label><textarea id={id} className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

/** A list edited as one item per line. Keeps the raw text while typing, so a new empty line is not swallowed. */
export function Lines({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const id = useId();
  const [text, setText] = useState(value.join("\n"));
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="field" rows={Math.max(2, Math.min(8, value.length + 1))} value={text}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)); }} />
    </div>
  );
}
