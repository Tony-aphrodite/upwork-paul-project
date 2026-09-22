"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { exportBundle } from "@/lib/client-actions";
import { Meta, PriorityChip } from "@/components/ui";
import { OverviewTab } from "./OverviewTab";
import { ActionsTab } from "./ActionsTab";
import { ProfileTab } from "./ProfileTab";
import { DocumentsTab } from "./DocumentsTab";
import { HistoryTab } from "./HistoryTab";
import { DataTab } from "./DataTab";

const TABS = [["overview", "Overview"], ["actions", "Actions and progress"], ["profile", "Family profile"], ["documents", "Documents"], ["history", "Versions"], ["data", "Structured data"]] as const;
export type Tab = (typeof TABS)[number][0];

export default function PlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("overview");
  const [docVersion, setDocVersion] = useState<string | null>(null);
  if (!ws) return <p className="text-muted">Loading…</p>;
  const rec = ws.plans[planId];
  if (!rec) return <div className="card p-6"><p>This plan is not in this browser&rsquo;s workspace.</p><Link href="/admin" className="btn-outline mt-3">Back to the workspace</Link></div>;
  const p = rec.profile.person;
  const latest = rec.versions.at(-1)!;
  const dirty = JSON.stringify(rec.working.actions) !== JSON.stringify(latest.actions);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-brand"><ArrowLeft size={15} aria-hidden="true" />Workspace</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Family Action Plan</p>
          <h1 className="mt-1 text-[28px]">{p.firstName} {p.lastName}, {p.age}</h1>
          <p className="text-muted">{p.town} · prepared for {rec.profile.preparedFor.name} ({rec.profile.preparedFor.relationship})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => exportBundle(rec)}><Download size={15} aria-hidden="true" />Export JSON</button>
          <button className="btn-primary" onClick={() => { setDocVersion(null); setTab("documents"); }}><FileText size={15} aria-hidden="true" />Documents</button>
        </div>
      </div>
      <div className="card p-4">
        <Meta items={[["Plan ID", <span key="i" className="font-mono">{rec.planId}</span>], ["Version", <span key="v">{rec.working.version}{dirty && <span className="ml-2 chip bg-soon-soft text-soon">Unsaved progress</span>}</span>], ["Created", new Date(rec.working.createdAt).toLocaleDateString("en-NZ", { dateStyle: "medium" })], ["Last updated", new Date(rec.working.updatedAt).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })]]} />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[13px] text-muted">Priorities: {rec.working.priorities.map((x) => <span key={x.moduleId} className="inline-flex items-center gap-1"><PriorityChip p={x.level} /> {x.title}</span>)}</div>
      </div>
      <div role="tablist" aria-label="Plan sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([id, label]) => <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className={clsx("-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[14px] font-semibold", tab === id ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand")}>{label}{id === "actions" && dirty ? " •" : ""}</button>)}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <OverviewTab rec={rec} />}
        {tab === "actions" && <ActionsTab rec={rec} dirty={dirty} />}
        {tab === "profile" && <ProfileTab rec={rec} onDone={() => setTab("history")} />}
        {tab === "documents" && <DocumentsTab rec={rec} version={docVersion} onVersion={setDocVersion} />}
        {tab === "history" && <HistoryTab rec={rec} onPreview={(v) => { setDocVersion(v); setTab("documents"); }} />}
        {tab === "data" && <DataTab rec={rec} />}
      </div>
    </div>
  );
}
