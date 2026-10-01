"use client";

import { FEEDBACK_LABEL, REQUEST_STATUSES, REQUEST_STATUS_LABEL, type Feedback, type RequestStatus } from "@/lib/case-status";
import { nzDateTime } from "@/lib/format";

export type AnswerGroup = { title: string; items: { q: string; a: string[] }[] };
export type RequestView = { id: string; createdAt: string; services: string[]; contactMethod: "phone" | "email"; phone: string | null; bestTime: string; message: string; status: RequestStatus };

/** The family's answers, as asked: only the questions they saw, with the option labels. */
export function AnswersTab({ groups }: { groups: AnswerGroup[] }) {
  return (
    <div className="space-y-5">
      {groups.map((s) => (
        <section key={s.title} className="card p-5">
          <h2 className="text-[17px]">{s.title}</h2>
          <dl className="mt-3 space-y-3">
            {s.items.map((it) => <div key={it.q}><dt className="text-[13.5px] font-semibold text-muted">{it.q}</dt><dd className="text-[15px]">{it.a.length > 1 ? <ul className="list-disc pl-5">{it.a.map((x) => <li key={x}>{x}</li>)}</ul> : it.a[0]}</dd></div>)}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function RequestsTab(props: { requests: RequestView[]; feedback: Feedback | null; feedbackAt: string | null; email: string; serviceLabels: Record<string, string>; onStatus: (id: string, s: RequestStatus) => void }) {
  const { feedback } = props;
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-[17px]">Implementation requests</h2>
        {props.requests.length === 0 ? <p className="mt-2 text-muted">None yet.</p> : props.requests.map((r) => (
          <div key={r.id} className="mt-4 border-t border-line pt-4 first:mt-2 first:border-0 first:pt-0">
            <p className="text-[13px] text-muted">{nzDateTime(r.createdAt)}</p>
            <p className="mt-1 font-semibold">{r.services.map((s) => props.serviceLabels[s] ?? s).join(", ") || "No service chosen"}</p>
            <p className="text-[14.5px]">Contact by {r.contactMethod === "phone" ? `phone: ${r.phone}` : `email: ${props.email}`}{r.bestTime ? ` · ${r.bestTime}` : ""}</p>
            {r.message && <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-muted">&ldquo;{r.message}&rdquo;</p>}
            <label className="mt-2 inline-flex items-center gap-2 text-[14px]">Status
              <select className="field !w-auto" value={r.status} onChange={(e) => props.onStatus(r.id, e.target.value as RequestStatus)}>
                {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
        ))}
      </section>
      <section className="card p-5">
        <h2 className="text-[17px]">Feedback</h2>
        {!feedback ? <p className="mt-2 text-muted">None yet.</p> : (
          <dl className="mt-3 grid gap-2 text-[14.5px] sm:grid-cols-[14rem_1fr]">
            <dt className="font-semibold text-muted">Useful</dt><dd>{FEEDBACK_LABEL[feedback.useful]}</dd>
            <dt className="font-semibold text-muted">Made sense</dt><dd>{FEEDBACK_LABEL[feedback.madeSense]}</dd>
            <dt className="font-semibold text-muted">Missing</dt><dd className="whitespace-pre-wrap">{feedback.missing || "—"}</dd>
            <dt className="font-semibold text-muted">Confusing or incorrect</dt><dd className="whitespace-pre-wrap">{feedback.confusing || "—"}</dd>
            <dt className="font-semibold text-muted">Wants help</dt><dd>{feedback.wantsHelp ? "Yes" : "No"}</dd>
            <dt className="font-semibold text-muted">Received</dt><dd>{nzDateTime(props.feedbackAt)}</dd>
          </dl>
        )}
      </section>
    </div>
  );
}
