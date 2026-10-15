"use client";

import clsx from "clsx";
import { ArrowRight, Brain, Building2, Compass, HandHeart, Hospital, Hotel, House, PersonStanding, type LucideIcon } from "lucide-react";
import type { QuestionDefinition } from "@/lib/questionnaire/schema";

/** An icon for each reason on the client's website. Presentation only: any other option gets the compass. */
const ICONS: Record<string, LucideIcon> = {
  dementia_diagnosis: Brain, hospital: Hospital, fall_stroke_mobility: PersonStanding, managing_home: House,
  carer_change: HandHeart, considering_village: Building2, considering_residential: Hotel, what_next: Compass,
};

/**
 * A card question (every option has a description), laid out like the cards on the client's website. Each card is a
 * button: choosing it records the answer and moves on, by mouse, touch or keyboard (Tab, then Enter or Space).
 */
export function ReasonCards({ q, value, onPick }: { q: QuestionDefinition; value: string | undefined; onPick: (value: string) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{q.label}</legend>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {q.options.map((o) => {
          const Icon = ICONS[o.value] ?? Compass;
          const chosen = value === o.value;
          return (
            <li key={o.value} className="flex">
              <button type="button" aria-pressed={chosen} data-value={o.value} onClick={() => onPick(o.value)}
                className={clsx("group flex w-full flex-col rounded-xl border bg-white p-4 text-left shadow-card transition-colors hover:border-brand/60 sm:p-5",
                  chosen ? "border-brand ring-2 ring-brand/25" : "border-line")}>
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon size={21} aria-hidden="true" /></span>
                  <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors", chosen ? "bg-brand text-white" : "bg-paper text-brand group-hover:bg-brand group-hover:text-white")}>
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-4 text-[20px] font-semibold leading-snug text-ink">{o.label}</span>
                {o.description && <span className="mt-1.5 text-[18px] leading-snug text-muted">{o.description}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
