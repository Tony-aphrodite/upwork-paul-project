import Link from "next/link";
import { ArrowRight, ClipboardList, FileCheck2, HandHelping } from "lucide-react";
import { FamilyShell } from "@/components/FamilyShell";
import { content } from "@/lib/pilot/library";
import { cleanReferral } from "@/lib/validate";

const STEPS: [typeof ClipboardList, string, string][] = [
  [ClipboardList, "Tell us what has changed", "Answer questions about the situation. You only see the ones that apply, and “not sure” is always fine."],
  [FileCheck2, "A navigator checks your plan", "Your personalised Family Ageing Action Plan is checked by a person before it is sent to you."],
  [HandHelping, "Do it yourself, or ask for help", "Every step says who can help. If you would like us to organise things, you can ask from your plan."],
];

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ref = cleanReferral(String((await searchParams).ref ?? ""));
  const start = ref ? `/start?ref=${ref}` : "/start";
  return (
    <FamilyShell>
      <section className="max-w-3xl">
        {content.texts.home_eyebrow && <p className="eyebrow">{content.texts.home_eyebrow}</p>}
        <h1 className="mt-3 text-[clamp(1.9rem,4.5vw,3rem)] leading-tight">{content.texts.home_heading}</h1>
        <p className="mt-5 text-[17px] text-muted">{content.texts.home_intro}</p>
        <Link href={start} className="btn-primary mt-8 !min-h-[48px] !px-6 !text-[16px]">Start the questionnaire<ArrowRight size={18} aria-hidden="true" /></Link>
        <p className="mt-3 text-[13.5px] text-muted">Takes about 10 to 15 minutes. You can stop and come back on the same device.</p>
      </section>
      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="How it works">
        {STEPS.map(([Icon, title, text], i) => (
          <div key={title} className="card p-5">
            <Icon size={22} className="text-brand" aria-hidden="true" />
            <h2 className="mt-3 text-[17px]"><span className="sr-only">Step {i + 1}: </span>{title}</h2>
            <p className="mt-1.5 text-[14.5px] text-muted">{text}</p>
          </div>
        ))}
      </section>
    </FamilyShell>
  );
}
