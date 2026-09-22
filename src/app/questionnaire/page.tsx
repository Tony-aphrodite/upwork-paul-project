import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { questionnaire } from "@/lib/questionnaire/library";
import { QuestionnaireForm } from "./QuestionnaireForm";

export const metadata: Metadata = { title: "Free Family Ageing Questionnaire", description: "Tell us what is happening and we will prepare your personalised Family Ageing Action Plan." };

export default function QuestionnairePage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-gold/25 text-[13px] text-ink"><div className="wrap py-1.5">Proof of concept. Kinfield Navigator is a fictional name and no answers are stored on a server.</div></div>
      <header className="border-b border-line bg-white">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Kinfield Action Plans, home"><Logo /></Link>
          <Link href="/docs" className="text-[14px] font-semibold text-muted hover:text-brand">How this works</Link>
        </div>
      </header>
      <main id="main" className="wrap py-8 sm:py-10"><QuestionnaireForm doc={questionnaire} /></main>
      <footer className="wrap pb-10 text-[13px] text-muted">
        Ageing Navigator provides information and navigation. It does not provide medical, legal or financial advice, and does not carry out formal needs assessments.
      </footer>
    </div>
  );
}
