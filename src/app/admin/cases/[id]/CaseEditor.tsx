"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, Check, Copy, Eye, FileDown, Loader2, RefreshCw, RotateCcw, Send, Trash2 } from "lucide-react";
import type { PilotPlan } from "@/lib/pilot/plan";
import { PLAN_CSS, renderPlanSections } from "@/lib/pilot/render";
import { nzDate, nzDateTime } from "@/lib/format";
import { STATUS_LABEL, type CaseStatus, type Feedback, type RequestStatus } from "@/lib/case-status";
import { PlanForm } from "./PlanForm";
import { AnswersTab, RequestsTab, type AnswerGroup, type RequestView } from "./SideTabs";
import { Box } from "./fields";

export type CaseView = {
  id: string; reference: string; status: CaseStatus; version: number; urgent: boolean;
  submittedAt: string; releasedAt: string | null; retainUntil: string; contentVersion: string; currentContentVersion: string;
  contact: { name: string; email: string; phone: string }; personName: string; referral: string | null; marketingConsent: boolean;
  releaseEmailStatus: "sent" | "failed" | null; plan: PilotPlan; hasReleased: boolean; releasedDiffers: boolean; note: string;
  answers: AnswerGroup[]; requests: RequestView[]; feedback: Feedback | null; feedbackAt: string | null; serviceLabels: Record<string, string>;
};

type Reply = { ok: boolean; json: Record<string, unknown> };
async function call(url: string, method: string, body?: unknown): Promise<Reply> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  return { ok: !!res?.ok, json: ((await res?.json().catch(() => null)) ?? { error: "Could not reach the server. Check the connection and try again." }) as Record<string, unknown> };
}
/** The most useful message in an error reply: the first field problem, else the error. */
const problem = (r: Reply, fallback: string) => {
  const d = (r.json.details as { path: string; message: string }[] | undefined)?.[0];
  return d ? `${d.message}${d.path ? ` (${d.path})` : ""}` : String(r.json.error ?? fallback);
};

const TABS = [["plan", "Plan"], ["answers", "Answers"], ["requests", "Requests and feedback"]] as const;
type Tab = (typeof TABS)[number][0];

/** The review screen: read the answers, edit any wording, remove or restore, preview, then release. */
export function CaseEditor({ data }: { data: CaseView }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PilotPlan>(data.plan);
  const [note, setNote] = useState(data.note);
  const [version, setVersion] = useState(data.version);
  const [status, setStatus] = useState<CaseStatus>(data.status);
  const [hasReleased, setHasReleased] = useState(data.hasReleased);
  const [releasedDiffers, setReleasedDiffers] = useState(data.releasedDiffers);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [preview, setPreview] = useState(false);
  const [released, setReleased] = useState<{ link: string; emailSent?: boolean; expires: string } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [requests, setRequests] = useState(data.requests);
  /** Edits made so far; a save only clears "unsaved" if nothing was typed while it was on its way. */
  const revision = useRef(0);
  const leaving = useRef(false);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty && !leaving.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touched = () => { revision.current += 1; setDirty(true); setMessage(null); };
  const edit = (next: PilotPlan) => { setPlan(next); touched(); };
  const closed = status === "closed";
  const fail = (r: Reply, fallback: string) => setMessage({ kind: "error", text: problem(r, fallback) });

  /** Save the edits; returns the new version, or null when saving failed. */
  async function save(): Promise<number | null> {
    const sentRevision = revision.current;
    setBusy("save");
    const r = await call(`/api/admin/cases/${data.id}`, "PATCH", { version, plan, note });
    setBusy(null);
    if (!r.ok) { fail(r, "Could not save."); return null; }
    const v = Number(r.json.version);
    setVersion(v);
    if (revision.current === sentRevision) { setDirty(false); setMessage({ kind: "ok", text: "Saved." }); }
    else setMessage({ kind: "ok", text: "Saved. You have made more changes since; save again to keep them." });
    if (status === "submitted") setStatus("in_review");
    if (hasReleased) setReleasedDiffers(true);
    return v;
  }

  async function releaseNow() {
    const before = revision.current;
    const v = dirty ? await save() : version;
    if (v === null) { setConfirmRelease(false); return; }
    if (revision.current !== before) {
      setConfirmRelease(false);
      setMessage({ kind: "error", text: "You changed the plan while it was saving. Save again, then release." });
      return;
    }
    setBusy("release");
    const r = await call(`/api/admin/cases/${data.id}/release`, "POST", { version: v });
    setBusy(null); setConfirmRelease(false);
    if (!r.ok) return fail(r, "Could not release.");
    setVersion(Number(r.json.version)); setStatus("released"); setHasReleased(true); setReleasedDiffers(false);
    setReleased({ link: String(r.json.link), emailSent: Boolean(r.json.emailSent), expires: String(r.json.expires) });
    setMessage(null);
  }

  async function newLink(send: boolean) {
    setBusy(send ? "resend" : "link");
    const r = await call(`/api/admin/cases/${data.id}/link`, "POST", { send });
    setBusy(null);
    if (!r.ok) return fail(r, "Could not make a new link.");
    setReleased({ link: String(r.json.link), emailSent: r.json.emailSent as boolean | undefined, expires: String(r.json.expires) });
  }

  async function setClosed(closeIt: boolean) {
    setBusy("close");
    const r = await call(`/api/admin/cases/${data.id}/close`, "POST", { closed: closeIt, version });
    setBusy(null);
    if (!r.ok) return fail(r, "Could not change the status.");
    setVersion(Number(r.json.version));
    setStatus(closeIt ? "closed" : hasReleased ? "released" : "in_review");
    setMessage({ kind: "ok", text: closeIt ? "Case closed." : "Case reopened." });
  }

  async function regenerate() {
    if (!window.confirm("Rebuild this plan from the family's answers with the current content? Your edits to the working plan will be lost. The released plan is not changed.")) return;
    setBusy("regenerate");
    const r = await call(`/api/admin/cases/${data.id}/regenerate`, "POST", { version });
    setBusy(null);
    if (!r.ok) return fail(r, "Could not regenerate.");
    leaving.current = true;
    window.location.reload();
  }

  async function remove() {
    setBusy("delete");
    const r = await call(`/api/admin/cases/${data.id}`, "DELETE", { confirm: deleteText });
    setBusy(null);
    if (!r.ok) return fail(r, "Could not delete.");
    leaving.current = true;
    router.push("/admin"); router.refresh();
  }

  async function requestStatus(id: string, s: RequestStatus) {
    const r = await call(`/api/admin/requests/${id}`, "PATCH", { status: s });
    if (r.ok) setRequests(requests.map((x) => (x.id === id ? { ...x, status: s } : x)));
    else fail(r, "Could not change the request status.");
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage({ kind: "ok", text: "Link copied." }); }
    catch { setMessage({ kind: "error", text: "Could not copy. Select the link and copy it by hand." }); }
  }

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next][0]);
    document.getElementById(`tab-${TABS[next][0]}`)?.focus();
  };

  const previewHtml = useMemo(() => (preview ? renderPlanSections(plan, { mode: "web", requestHref: "#" }) : ""), [preview, plan]);
  const newRequests = requests.filter((r) => r.status === "new").length;
  const saveFirst = dirty ? "Save your changes first" : undefined;

  return (
    <div className="pb-44 sm:pb-28">
      {/* ---------- header ---------- */}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[15px] font-bold">{data.reference}</span>
          <span className="chip bg-brand-soft text-brand">{STATUS_LABEL[status]}</span>
          {data.urgent && <span className="chip bg-now text-white"><AlertTriangle size={12} className="mr-1" aria-hidden="true" />Urgent</span>}
        </p>
        <h1 className="mt-1 text-[26px]">{data.personName}</h1>
        <p className="text-[14px] text-muted">For {data.contact.name} · <a className="underline" href={`mailto:${data.contact.email}`}>{data.contact.email}</a>{data.contact.phone ? ` · ${data.contact.phone}` : ""}</p>
        <p className="mt-1 text-[13px] text-muted">
          Submitted {nzDateTime(data.submittedAt)}{data.releasedAt ? ` · released ${nzDateTime(data.releasedAt)}` : ""} · kept until {nzDate(data.retainUntil)}
          {data.referral ? ` · via ${data.referral}` : ""}{data.marketingConsent ? " · agreed to news" : ""}
        </p>
      </div>

      {data.contentVersion !== data.currentContentVersion && (
        <p className="mt-4 rounded-lg bg-soon-soft p-3 text-[14px] text-soon">This plan was built with content {data.contentVersion}; the current content is {data.currentContentVersion}. Use &ldquo;Regenerate from answers&rdquo; to rebuild it with the current wording.</p>
      )}
      {hasReleased && data.releaseEmailStatus === "failed" && !released && (
        <p className="mt-4 rounded-lg bg-now-soft p-3 text-[14px] text-now">The release email could not be sent. Email a new link below, or make one to copy and send it yourself.</p>
      )}

      {released && (
        <div role="status" className="card mt-5 border-ahead p-5">
          <p className="flex items-center gap-2 text-[16px] font-bold text-ahead"><Check size={18} aria-hidden="true" />{released.emailSent === false ? "Released, but the email failed" : released.emailSent ? `Released and emailed to ${data.contact.email}` : "New link made"}</p>
          <p className="mt-2 text-[13.5px] text-muted">This link is shown once. It works until {nzDate(released.expires)}; any earlier link has stopped working.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded bg-sand px-2 py-1 text-[12.5px]">{released.link}</code>
            <button type="button" className="btn-outline" onClick={() => void copy(released.link)}><Copy size={15} aria-hidden="true" />Copy link</button>
          </div>
        </div>
      )}

      {/* ---------- tabs ---------- */}
      <div role="tablist" aria-label="Case" className="mt-6 flex flex-wrap gap-1.5 border-b border-line" onKeyDown={onTabKey}>
        {TABS.map(([k, l]) => (
          <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`panel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}
            className={clsx("-mb-px rounded-t-lg border px-3.5 py-2 text-[14px] font-semibold", tab === k ? "border-line border-b-white bg-white text-brand" : "border-transparent text-muted hover:text-brand")}>
            {l}{k === "requests" && newRequests > 0 ? ` (${newRequests} new)` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "answers" && <AnswersTab groups={data.answers} />}
        {tab === "requests" && <RequestsTab requests={requests} feedback={data.feedback} feedbackAt={data.feedbackAt} email={data.contact.email} serviceLabels={data.serviceLabels} onStatus={(id, s) => void requestStatus(id, s)} />}
        {tab === "plan" && (
          <div className="space-y-5">
            <PlanForm plan={plan} onChange={edit} note={note} onNote={(v) => { setNote(v); touched(); }}
              releasedNote={releasedDiffers ? `The family sees the version released on ${nzDate(data.releasedAt)}. Edits reach them only when you release again.` : undefined} />
            {preview && (
              <section className="card p-5 sm:p-7" aria-label="Preview">
                <p className="eyebrow mb-4">Preview: what the family will see</p>
                <style>{PLAN_CSS(".anplan")}</style>
                <div className="anplan text-[15px]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </section>
            )}
            <Box title="Other actions">
              {saveFirst && <p className="text-[13.5px] text-muted">Save your changes before using these.</p>}
              <div className="flex flex-wrap gap-2">
                {hasReleased && <a className="btn-outline" href={`/api/admin/cases/${data.id}/pdf?which=released`}><FileDown size={15} aria-hidden="true" />Released PDF</a>}
                {hasReleased && !closed && <button type="button" className="btn-outline" disabled={!!busy} onClick={() => void newLink(true)}>{busy === "resend" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}Email a new link</button>}
                {hasReleased && !closed && <button type="button" className="btn-outline" disabled={!!busy} onClick={() => void newLink(false)}><Copy size={15} aria-hidden="true" />New link to copy</button>}
                <button type="button" className="btn-outline" disabled={!!busy || dirty || closed} title={saveFirst} onClick={() => void regenerate()}><RefreshCw size={15} aria-hidden="true" />Regenerate from answers</button>
                <button type="button" className="btn-outline" disabled={!!busy || dirty} title={saveFirst} onClick={() => void setClosed(!closed)}>{closed ? <><RotateCcw size={15} aria-hidden="true" />Reopen</> : <><Check size={15} aria-hidden="true" />Close case</>}</button>
              </div>
              <div className="mt-2 rounded-lg border border-now/30 p-3">
                <p className="text-[14px] font-semibold text-now">Delete this case now</p>
                <p className="text-[13.5px] text-muted">Deletes the answers, plans, link, requests and feedback. It cannot be undone. Type <span className="font-mono font-bold">{data.reference}</span> to confirm.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input className="field !w-44" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} aria-label={`Type ${data.reference} to confirm deletion`} />
                  <button type="button" className="btn !bg-now text-white" disabled={deleteText.trim().toUpperCase() !== data.reference || !!busy} onClick={() => void remove()}><Trash2 size={15} aria-hidden="true" />Delete</button>
                </div>
              </div>
            </Box>
          </div>
        )}
      </div>

      {/* ---------- action bar ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="wrap flex flex-wrap items-center gap-2 py-2.5">
          <button type="button" className="btn-primary" disabled={!dirty || !!busy || closed} onClick={() => void save()}>{busy === "save" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{dirty ? "Save changes" : "Saved"}</button>
          <button type="button" className="btn-outline" aria-pressed={preview} onClick={() => { setTab("plan"); setPreview(!preview); }}><Eye size={15} aria-hidden="true" />{preview ? "Hide preview" : "Preview"}</button>
          <a className="btn-outline" href={`/api/admin/cases/${data.id}/pdf`} onClick={(e) => { if (dirty) { e.preventDefault(); setMessage({ kind: "error", text: "Save your changes first, then open the PDF preview." }); } }}><FileDown size={15} aria-hidden="true" /><span className="hidden sm:inline">PDF preview</span><span className="sm:hidden">PDF</span></a>
          {!closed && (confirmRelease ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-2 py-1 text-[13.5px]">
              {hasReleased ? "Release again and send a new link?" : `Release to ${data.contact.email}?`}
              <button type="button" className="btn-primary !min-h-[32px]" disabled={!!busy} onClick={() => void releaseNow()}>{busy === "release" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}Yes, release</button>
              <button type="button" className="btn-ghost !min-h-[32px]" onClick={() => setConfirmRelease(false)}>Cancel</button>
            </span>
          ) : <button type="button" className="btn-primary ml-auto" disabled={!!busy} onClick={() => setConfirmRelease(true)}><Send size={15} aria-hidden="true" />{hasReleased ? "Release again" : "Approve and release"}</button>)}
          {message && <p role={message.kind === "error" ? "alert" : "status"} className={clsx("w-full text-[13.5px] font-semibold", message.kind === "error" ? "text-now" : "text-ahead")}>{message.text}</p>}
        </div>
      </div>
    </div>
  );
}
