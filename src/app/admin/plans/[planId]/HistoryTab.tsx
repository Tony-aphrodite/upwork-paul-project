"use client";

import { Eye } from "lucide-react";
import type { PlanRecord } from "@/lib/workspace";
import { Card } from "@/components/ui";

export function HistoryTab({ rec, onPreview }: { rec: PlanRecord; onPreview: (v: string) => void }) {
  const title = (key: string) => rec.versions.flatMap((v) => v.actions).find((a) => a.key === key)?.title ?? key;
  const modTitle = (id: string) => rec.versions.flatMap((v) => v.modules).find((m) => m.id === id)?.title ?? id;
  return (
    <Card title={`Versions (${rec.versions.length})`}>
      <p className="mb-4 text-[13.5px] text-muted">Saved versions are never edited. Each one records why it was created and what changed, and any version can be reopened or reprinted.</p>
      <ol className="space-y-3">
        {[...rec.versions].reverse().map((v) => {
          const h = v.history.at(-1)!;
          const c = h.changes;
          return (
            <li key={v.version} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">Version {v.version} <span className="font-normal text-muted">· {new Date(h.at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}</span></p><p className="text-[14px] text-muted">{h.reason}</p></div>
                <button className="btn-outline !min-h-[34px]" onClick={() => onPreview(v.version)}><Eye size={15} aria-hidden="true" />Preview</button>
              </div>
              {c && (c.added.length + c.removed.length + c.changed.length + c.modulesAdded.length + c.modulesRemoved.length > 0) && (
                <ul className="mt-3 space-y-1 text-[13.5px]">
                  {c.modulesAdded.map((m) => <li key={`ma${m}`}><span className="chip bg-ahead-soft text-ahead">Topic added</span> {modTitle(m)}</li>)}
                  {c.modulesRemoved.map((m) => <li key={`mr${m}`}><span className="chip bg-sand text-muted">Topic removed</span> {modTitle(m)}</li>)}
                  {c.added.map((k) => <li key={`a${k}`}><span className="chip bg-ahead-soft text-ahead">New action</span> {title(k)}</li>)}
                  {c.removed.map((k) => <li key={`r${k}`}><span className="chip bg-sand text-muted">No longer needed</span> {title(k)}</li>)}
                  {c.changed.map((x) => <li key={`c${x.key}`}><span className="chip bg-soon-soft text-soon">Changed</span> {title(x.key)} <span className="text-muted">({x.fields.join(", ")})</span></li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
