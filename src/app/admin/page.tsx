import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, MessageSquare, PhoneCall } from "lucide-react";
import { counts, listCases, STATUS_LABEL, type ListFilter } from "@/lib/cases";
import { PATHWAY_LABEL, nzDateTime } from "@/lib/format";

const TABS: [ListFilter, string][] = [["open", "To review"], ["released", "Released"], ["closed", "Closed"], ["all", "All"]];
const STATUS_CLS = { submitted: "bg-now-soft text-now", in_review: "bg-soon-soft text-soon", released: "bg-ahead-soft text-ahead", closed: "bg-line/60 text-muted" } as const;

/** The case list. It shows who and what stage, not health details; urgent cases come first in "To review". */
export default async function Cases({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const show = ((await searchParams).show ?? "open") as ListFilter;
  const filter: ListFilter = TABS.some(([k]) => k === show) ? show : "open";
  const [rows, n] = await Promise.all([listCases(filter), counts()]);
  return (
    <div>
      <h1 className="text-[26px]">Cases</h1>
      <nav aria-label="Filter cases" className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin?show=${k}`} aria-current={k === filter ? "page" : undefined}
            className={clsx("rounded-lg px-3 py-1.5 text-[14px] font-semibold", k === filter ? "bg-brand text-white" : "bg-white text-brand ring-1 ring-line hover:ring-brand/40")}>
            {l} <span className={clsx("ml-1 text-[12.5px]", k === filter ? "text-white/80" : "text-muted")}>{n[k]}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="card mt-5 p-6 text-muted">No cases here yet.</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cases/${c.id}`} className={clsx("card flex flex-col gap-2 p-4 hover:border-brand/40 sm:flex-row sm:items-center sm:justify-between", c.urgent && c.status !== "closed" && "border-l-4 border-l-now")}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[14px] font-bold text-ink">{c.reference}</span>
                    <span className={clsx("chip", STATUS_CLS[c.status])}>{STATUS_LABEL[c.status]}</span>
                    {c.urgent && <span className="chip bg-now text-white"><AlertTriangle size={12} className="mr-1" aria-hidden="true" />Urgent</span>}
                    {c.openRequests > 0 && <span className="chip bg-brand text-white"><PhoneCall size={12} className="mr-1" aria-hidden="true" />Help requested</span>}
                    {c.hasFeedback && <span className="chip bg-brand-soft text-brand"><MessageSquare size={12} className="mr-1" aria-hidden="true" />Feedback</span>}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-semibold text-brand">{c.personName} <span className="font-normal text-muted">· for {c.contactName}</span></p>
                  <p className="mt-0.5 text-[13px] text-muted">{c.pathways.map((p) => PATHWAY_LABEL[p] ?? p).join(", ") || "No pathway yet"}{c.referral ? ` · via ${c.referral}` : ""}</p>
                </div>
                <p className="shrink-0 text-[13px] text-muted">Submitted {nzDateTime(c.submittedAt)}{c.releasedAt ? <><br className="hidden sm:block" /><span className="sm:hidden"> · </span>Released {nzDateTime(c.releasedAt)}</> : null}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
