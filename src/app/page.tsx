import Link from "next/link";
import { ArrowRight, Database, FileText, History, Layers, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Logo } from "@/components/ui";

const FLOW = ["Questionnaire data", "Structured Family Profile", "Structured Action Plan", "Reusable HTML/CSS template", "Professional PDF"];
const POINTS: [typeof Database, string, string][] = [
  [Database, "Plans are data, not documents", "Every action is its own record with priority, timing, owner and status. The PDF is just one view of it."],
  [Layers, "Modules switch on by rule", "Eighteen topic modules, each with conditions written as data. Irrelevant topics never appear, and new ones need no code."],
  [History, "A living plan", "Update the profile or the progress and a new version is created. Status and notes carry over; nothing starts from scratch."],
  [FileText, "Two documents, one source", "A full Family Action Plan and a one-to-two page Professional Summary, both generated from the same record."],
  [SlidersHorizontal, "Transparent options", "Where providers are shown, each one lists which criteria it matches and which it does not. No hidden ranking."],
  [ShieldCheck, "Private by default", "Signed-in access only, no family data in logs, PDFs streamed without being stored, and no public pages with personal details."],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-sand">
      <div className="wrap flex h-16 items-center justify-between"><Logo /><Link href="/login" className="btn-primary">Open the test console</Link></div>
      <section className="wrap py-14 md:py-20">
        <p className="eyebrow">Proof of concept</p>
        <h1 className="mt-3 max-w-3xl text-[clamp(2rem,4.5vw,3.2rem)] leading-tight">A living Family Action Plan, generated from structured data</h1>
        <p className="mt-5 max-w-2xl text-[17px] text-muted">The first stage of an ageing-navigation service: turn a family&rsquo;s situation into a clear, prioritised plan and a professional PDF, in a way the questionnaire, AI and knowledge repository can plug into later.</p>
        <ol className="mt-10 flex flex-wrap items-center gap-2 text-[14px] font-semibold">
          {FLOW.map((f, i) => <li key={f} className="flex items-center gap-2"><span className="rounded-lg bg-white px-3 py-2 text-brand shadow-card">{f}</span>{i < FLOW.length - 1 && <ArrowRight size={16} className="text-muted" aria-hidden="true" />}</li>)}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3"><Link href="/login" className="btn-primary !min-h-[46px] !px-5">Open the test console<ArrowRight size={17} aria-hidden="true" /></Link><Link href="/docs" className="btn-outline !min-h-[46px] !px-5">Read the technical docs</Link></div>
      </section>
      <section className="border-t border-line bg-white py-14">
        <div className="wrap grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map(([Icon, t, d]) => <div key={t} className="card p-5"><Icon size={22} className="text-brand" aria-hidden="true" /><h2 className="mt-3 text-[17px]">{t}</h2><p className="mt-1.5 text-[14.5px] text-muted">{d}</p></div>)}
        </div>
        <p className="wrap mt-10 text-[13px] text-muted">All families in this demo are fictional. Kinfield Navigator is a placeholder name, and the providers shown are sample data.</p>
      </section>
    </div>
  );
}
