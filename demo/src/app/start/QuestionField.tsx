"use client";

import clsx from "clsx";
import type { Answers, QuestionDefinition } from "@/lib/questionnaire/schema";
import { isAnswered, TEXT_LIMIT } from "@/lib/questionnaire/logic";

/**
 * One question, in whichever of the five forms the content gives it. Exclusive options ("None of these", "Not sure")
 * clear the other choices and are cleared by them; "choose up to three" greys out the rest once three are chosen.
 */
export function QuestionField({ q, value, onChange, issue }: { q: QuestionDefinition; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void; issue?: string }) {
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
    <fieldset id={`q-${q.id}`} className="min-w-0 scroll-mt-24" aria-describedby={describedBy} aria-invalid={issue ? true : undefined}>
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
        {q.type === "short" && <input className="field max-w-md !text-[15px]" maxLength={TEXT_LIMIT.short} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />}
        {q.type === "long" && <textarea className="field !text-[15px]" rows={4} maxLength={TEXT_LIMIT.long} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={q.label} />}
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
      {q.max !== undefined && <p className="mt-1.5 text-[13px] text-muted" aria-live="polite">{selected.length} of {q.max} chosen</p>}
      {q.type === "multi" && !q.optional && !isAnswered(value) && <span className="sr-only">Select at least one option</span>}
    </fieldset>
  );
}
