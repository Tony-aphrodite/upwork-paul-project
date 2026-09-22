"use client";

import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, FileQuestion, Building2, BookOpen } from "lucide-react";
import { builtInLibrary } from "@/lib/library";
import { questionnaire } from "@/lib/questionnaire/library";
import { Card } from "@/components/ui";

/**
 * The repository of information behind every plan: the questionnaire, the topic modules, the sources the plans cite and
 * the provider records options are matched against. Each item carries the date it was last checked, because content that
 * quietly goes out of date is the main risk in a service like this.
 */

const MONTHS_STALE = 6;
const monthsSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });

export default function RepositoryPage() {
  const [tab, setTab] = useState<"questionnaire" | "sources" | "providers">("questionnaire");
  const { sources, providers, modules } = builtInLibrary;
  const staleSources = sources.filter((s) => monthsSince(s.reviewedOn) >= MONTHS_STALE);
  const unverified = providers.filter((p) => !p.verifiedOn || monthsSince(p.verifiedOn) >= MONTHS_STALE);
  const questions = questionnaire.sections.flatMap((s) => s.questions);

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Repository</p>
        <h1 className="mt-1 text-[28px]">The information the plans are built from</h1>
        <p className="mt-1 max-w-3xl text-muted">Questions, topic modules, cited sources and provider records are all content, not code. They are validated when loaded, so a broken edit fails before a family sees it, and each one carries when it was last checked.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[[FileQuestion, questions.length, "questions", `version ${questionnaire.version}`], [BookOpen, modules.length, "topic modules", "conditions as data"], [CheckCircle2, sources.length, "cited sources", `${staleSources.length} due for review`], [Building2, providers.length, "provider records", `${unverified.length} to verify`]].map(([Icon, n, label, note], i) => {
          const I = Icon as typeof BookOpen;
          return <Card key={i}><div className="p-4"><I size={18} className="text-brand" aria-hidden="true" /><p className="mt-2 text-[24px] font-semibold text-brand">{n as number}</p><p className="text-[14px]">{label as string}</p><p className="text-[12.5px] text-muted">{note as string}</p></div></Card>;
        })}
      </div>

      <div role="tablist" aria-label="Repository sections" className="flex flex-wrap gap-1 border-b border-line">
        {([["questionnaire", "Questionnaire"], ["sources", "Sources"], ["providers", "Providers"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={clsx("rounded-t-lg px-3 py-2 text-[14px] font-semibold", tab === id ? "border-b-2 border-brand text-brand" : "text-muted hover:text-brand")}>{label}</button>
        ))}
      </div>

      {tab === "questionnaire" && (
        <section aria-label="Questionnaire">
          <p className="text-[14px] text-muted">Version {questionnaire.version}. Sections marked conditional only appear when a family&rsquo;s answers call for them. Plans record the version they came from, so feedback can be read against the questions that were actually asked.</p>
          <ul className="mt-4 space-y-3">
            {questionnaire.sections.map((s) => (
              <li key={s.id} className="card p-4">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{s.title}{s.conditional && <span className="chip bg-soon-soft text-soon">Conditional</span>}<span className="text-[13px] font-normal text-muted">{s.questions.length} questions</span></p>
                {s.when && <p className="mt-1 font-mono text-[12px] text-muted">shown when {JSON.stringify(s.when)}</p>}
                <ul className="mt-2 space-y-1 text-[13.5px]">
                  {s.questions.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[12px] text-muted">{q.id}</span><span>{q.label}</span>
                      <span className="text-[12px] text-muted">{q.type}{q.max ? `, up to ${q.max}` : ""}{q.optional ? ", optional" : ""}{q.when ? ", conditional" : ""}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "sources" && (
        <section aria-label="Sources" className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr><th className="th">Title</th><th className="th">Publisher</th><th className="th">Reviewed</th><th className="th">Status</th></tr></thead>
            <tbody>
              {[...sources].sort((a, b) => a.reviewedOn.localeCompare(b.reviewedOn)).map((s) => {
                const months = monthsSince(s.reviewedOn);
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="td text-[14px]"><a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">{s.title}</a></td>
                    <td className="td text-[14px] text-muted">{s.publisher}</td>
                    <td className="td text-[14px]">{fmt(s.reviewedOn)}</td>
                    <td className="td">{months >= MONTHS_STALE
                      ? <span className="chip bg-now-soft text-now"><AlertTriangle size={12} className="mr-1" aria-hidden="true" />Review due ({months} months)</span>
                      : <span className="chip bg-ahead-soft text-ahead">Current</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {tab === "providers" && (
        <section aria-label="Providers" className="overflow-x-auto">
          <p className="text-[14px] text-muted">Sample records for the demo. Matching uses only what is recorded here: anything missing is reported to the family as not confirmed, never assumed.</p>
          <table className="mt-3 w-full min-w-[900px] text-left">
            <thead><tr><th className="th">Name</th><th className="th">Type</th><th className="th">Where</th><th className="th">Accommodation</th><th className="th">Care on site</th><th className="th">Pets</th><th className="th">From</th><th className="th">Verified</th></tr></thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="td text-[14px] font-semibold">{p.name}</td>
                  <td className="td text-[13.5px] text-muted">{p.type.replace(/_/g, " ")}</td>
                  <td className="td text-[13.5px]">{p.town ? `${p.town}, ` : ""}{p.regions.join(", ")}</td>
                  <td className="td text-[13.5px]">{p.accommodationTypes.length ? p.accommodationTypes.map((a) => a.replace(/_/g, " ")).join(", ") : <span className="text-muted">not recorded</span>}</td>
                  <td className="td text-[13.5px]">{p.careLevels.length ? p.careLevels.map((c) => c.replace(/_/g, " ")).join(", ") : <span className="text-muted">none</span>}</td>
                  <td className="td text-[13.5px]">{p.petsAllowed === undefined ? <span className="text-muted">not recorded</span> : p.petsAllowed ? "Yes" : "No"}</td>
                  <td className="td text-[13.5px]">{p.purchaseFrom ? `$${p.purchaseFrom.toLocaleString("en-NZ")}` : p.weeklyCostFrom ? `$${p.weeklyCostFrom}/week` : <span className="text-muted">not recorded</span>}</td>
                  <td className="td">{p.verifiedOn
                    ? <span className={clsx("chip", monthsSince(p.verifiedOn) >= MONTHS_STALE ? "bg-soon-soft text-soon" : "bg-ahead-soft text-ahead")}>{fmt(p.verifiedOn)}</span>
                    : <span className="chip bg-now-soft text-now">Never verified</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
