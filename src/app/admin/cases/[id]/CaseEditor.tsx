"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, Check, Copy, Eye, FileDown, Loader2, RefreshCw, RotateCcw, Send, Trash2, Undo2, X } from "lucide-react";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/schema";
import type { PilotPlan, PlanAction, PlanInfo } from "@/lib/pilot/plan";
import { PLAN_CSS, renderPlanSections } from "@/lib/pilot/render";
import { PATHWAY_LABEL, nzDate, nzDateTime } from "@/lib/format";
import type { CaseStatus, Feedback } from "@/lib/cases";

export type CaseView = {
  id: string; reference: string; status: CaseStatus; version: number; urgent: boolean;
  submittedAt: string; releasedAt: string | null; retainUntil: string; contentVersion: string; currentContentVersion: string;
  contact: { name: string; email: string; phone: string }; personName: string; referral: string | null; marketingConsent: boolean;
  releaseEmailStatus: "sent" | "failed" | null; plan: PilotPlan; hasReleased: boolean; releasedDiffers: boolean; note: string;
  answers: { title: string; items: { q: string; a: string[] }[] }[];
  requests: { id: string; createdAt: string; services: string[]; contactMethod: "phone" | "email"; phone: string | null; bestTime: string; message: string; status: "new" | "contacted" | "closed" }[];
  feedback: Feedback | null; feedbackAt: string | null; serviceLabels: Record<string, string>;
};

const STATUS_TEXT: Record<CaseStatus, string> = { submitted: "New", in_review: "In review", released: "Released", closed: "Closed" };
const INFO_TITLE: Record<PlanInfo["section"], string> = { funding: "E. Funding and assessment", check: "G. Things to check", professional: "H. Professional assessment or advice" };
const FEEDBACK_TEXT: Record<string, string> = { very: "Very useful", somewhat: "Somewhat useful", not_really: "Not really useful", yes: "Yes", partly: "Partly", no: "No" };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  const json = await res?.json().catch(() => ({}));
  return { ok: !!res?.ok, status: res?.status ?? 0, json: (json ?? {}) as Record<string, unknown> };
}

/** The review screen: read the answers, edit any wording, remove or restore actions, preview, then release. */
export function CaseEditor({ data }: { data: CaseView }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PilotPlan>(data.plan);
  const [note, setNote] = useState(data.note);
  const [version, setVersion] = useState(data.version);
  const [status, setStatus] = useState<CaseStatus>(data.status);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [tab, setTab] = useState<"plan" | "answers" | "requests">("plan");
  const [preview, setPreview] = useState(false);
  const [released, setReleased] = useState<{ link: string; emailSent?: boolean; expires: string } | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [requests, setRequests] = useState(data.requests);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (next: PilotPlan) => { setPlan(next); setDirty(true); setMessage(null); };
  const editAction = (key: string, patch: Partial<PlanAction>) => edit({ ...plan, actions: plan.actions.map((a) => (a.key === key ? { ...a, ...patch } : a)) });
  const editInfo = (id: string, patch: Partial<PlanInfo>) => edit({ ...plan, information: plan.information.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const closed = status === "closed";

  /** Save the edits; returns the new version, or null when saving failed. */
  async function save(): Promise<number | null> {
    setBusy("save");
    const r = await call(`/api/admin/cases/${data.id}`, "PATCH", { version, plan, note });
    setBusy(null);
    if (!r.ok) { setMessage({ kind: "error", text: String(r.json.error ?? "Could not save.") }); return null; }
    const v = Number(r.json.version);
    setVersion(v); setDirty(false); setMessage({ kind: "ok", text: "Saved." });
    if (status === "submitted") setStatus("in_review");
    return v;
  }

  async function releaseNow() {
    const v = dirty ? await save() : version;
    if (v === null) return;
    setBusy("release");
    const r = await call(`/api/admin/cases/${data.id}/release`, "POST", { version: v });
    setBusy(null); setConfirmRelease(false);
    if (!r.ok) { setMessage({ kind: "error", text: String(r.json.error ?? "Could not release.") }); return; }
    setVersion(Number(r.json.version)); setStatus("released");
    setReleased({ link: String(r.json.link), emailSent: Boolean(r.json.emailSent), expires: String(r.json.expires) });
    setMessage(null);
  }

  async function newLink(send: boolean) {
    setBusy(send ? "resend" : "link");
    const r = await call(`/api/admin/cases/${data.id}/link`, "POST", { send });
    setBusy(null);
    if (!r.ok) { setMessage({ kind: "error", text: String(r.json.error ?? "Could not make a new link.") }); return; }
    setReleased({ link: String(r.json.link), emailSent: r.json.emailSent as boolean | undefined, expires: String(r.json.expires) });
  }

  async function setClosed(closedNow: boolean) {
    setBusy("close");
    const r = await call(`/api/admin/cases/${data.id}/close`, "POST", { closed: closedNow });
    setBusy(null);
    if (r.ok) window.location.reload(); else setMessage({ kind: "error", text: String(r.json.error ?? "Could not change the status.") });
  }

  async function regenerate() {
    if (!window.confirm("Rebuild this plan from the family's answers with the current content? Your edits to the working plan will be lost. The released plan is not changed.")) return;
    setBusy("regenerate");
    const r = await call(`/api/admin/cases/${data.id}/regenerate`, "POST", { version });
    setBusy(null);
    if (r.ok) { setDirty(false); window.location.reload(); } else setMessage({ kind: "error", text: String(r.json.error ?? "Could not regenerate.") });
  }

  async function remove() {
    setBusy("delete");
    const r = await call(`/api/admin/cases/${data.id}`, "DELETE", { confirm: deleteText });
    setBusy(null);
    if (r.ok) { setDirty(false); router.push("/admin"); router.refresh(); } else setMessage({ kind: "error", text: String(r.json.error ?? "Could not delete.") });
  }

  async function requestStatus(id: string, s: "new" | "contacted" | "closed") {
    const r = await call(`/api/admin/requests/${id}`, "PATCH", { status: s });
    if (r.ok) setRequests(requests.map((x) => (x.id === id ? { ...x, status: s } : x)));
  }

  const previewHtml = useMemo(() => (preview ? renderPlanSections(plan, { mode: "web", requestHref: "#" }) : ""), [preview, plan]);
  const removedCount = plan.actions.filter((a) => a.removed).length;

  return (
    <div className="pb-24">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[15px] font-bold">{data.reference}</span>
            <span className="chip bg-brand-soft text-brand">{STATUS_TEXT[status]}</span>
            {data.urgent && <span className="chip bg-now text-white"><AlertTriangle size={12} className="mr-1" aria-hidden="true" />Urgent</span>}
          </p>
          <h1 className="mt-1 text-[26px]">{data.personName}</h1>
          <p className="text-[14px] text-muted">For {data.contact.name} · <a className="underline" href={`mailto:${data.contact.email}`}>{data.contact.email}</a>{data.contact.phone ? ` · ${data.contact.phone}` : ""}</p>
          <p className="mt-1 text-[13px] text-muted">
            Submitted {nzDateTime(data.submittedAt)}{data.releasedAt ? ` · released ${nzDateTime(data.releasedAt)}` : ""} · kept until {nzDate(data.retainUntil)}
            {data.referral ? ` · via ${data.referral}` : ""}{data.marketingConsent ? " · agreed to news" : ""}
          </p>
        </div>
      </div>

      {data.contentVersion !== data.currentContentVersion && (
        <p className="mt-4 rounded-lg bg-soon-soft p-3 text-[14px] text-soon">This plan was built with content {data.contentVersion}; the current content is {data.currentContentVersion}. Use &ldquo;Regenerate&rdquo; to rebuild it with the current wording.</p>
      )}
      {data.hasReleased && data.releaseEmailStatus === "failed" && !released && (
        <p className="mt-4 rounded-lg bg-now-soft p-3 text-[14px] text-now">The release email could not be sent. Send a new link below, or copy one and email it yourself.</p>
      )}

      {released && (
        <div role="status" className="card mt-5 border-ahead p-5">
          <p className="flex items-center gap-2 text-[16px] font-bold text-ahead"><Check size={18} aria-hidden="true" />{released.emailSent === false ? "Released, but the email failed" : released.emailSent ? `Released and emailed to ${data.contact.email}` : "New link made"}</p>
          <p className="mt-2 text-[13.5px] text-muted">This link is shown once. It works until {nzDate(released.expires)}; any earlier link has stopped working.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded bg-sand px-2 py-1 text-[12.5px]">{released.link}</code>
            <button className="btn-outline" onClick={() => void navigator.clipboard.writeText(released.link)}><Copy size={15} aria-hidden="true" />Copy link</button>
          </div>
        </div>
      )}

      {/* ---------- tabs ---------- */}
      <div role="tablist" aria-label="Case" className="mt-6 flex flex-wrap gap-1.5 border-b border-line">
        {([["plan", "Plan"], ["answers", "Answers"], ["requests", `Requests and feedback${requests.some((r) => r.status === "new") ? " •" : ""}`]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx("-mb-px rounded-t-lg border px-3.5 py-2 text-[14px] font-semibold", tab === k ? "border-line border-b-white bg-white text-brand" : "border-transparent text-muted hover:text-brand")}>{l}</button>
        ))}
      </div>

      {tab === "answers" && (
        <div className="mt-5 space-y-5">
          {data.answers.map((s) => (
            <section key={s.title} className="card p-5">
              <h2 className="text-[17px]">{s.title}</h2>
              <dl className="mt-3 space-y-3">
                {s.items.map((it) => <div key={it.q}><dt className="text-[13.5px] font-semibold text-muted">{it.q}</dt><dd className="text-[15px]">{it.a.length > 1 ? <ul className="list-disc pl-5">{it.a.map((x) => <li key={x}>{x}</li>)}</ul> : it.a[0]}</dd></div>)}
              </dl>
            </section>
          ))}
        </div>
      )}

      {tab === "requests" && (
        <div className="mt-5 space-y-5">
          <section className="card p-5">
            <h2 className="text-[17px]">Implementation requests</h2>
            {requests.length === 0 ? <p className="mt-2 text-muted">None yet.</p> : requests.map((r) => (
              <div key={r.id} className="mt-4 border-t border-line pt-4 first:mt-2 first:border-0 first:pt-0">
                <p className="text-[13px] text-muted">{nzDateTime(r.createdAt)}</p>
                <p className="mt-1 font-semibold">{r.services.map((s) => data.serviceLabels[s] ?? s).join(", ") || "No service chosen"}</p>
                <p className="text-[14.5px]">Contact by {r.contactMethod === "phone" ? `phone: ${r.phone}` : `email: ${data.contact.email}`}{r.bestTime ? ` · ${r.bestTime}` : ""}</p>
                {r.message && <p className="mt-1 whitespace-pre-wrap text-[14.5px] text-muted">&ldquo;{r.message}&rdquo;</p>}
                <label className="mt-2 inline-flex items-center gap-2 text-[14px]">Status
                  <select className="field !w-auto" value={r.status} onChange={(e) => void requestStatus(r.id, e.target.value as "new" | "contacted" | "closed")}>
                    <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
                  </select>
                </label>
              </div>
            ))}
          </section>
          <section className="card p-5">
            <h2 className="text-[17px]">Feedback</h2>
            {!data.feedback ? <p className="mt-2 text-muted">None yet.</p> : (
              <dl className="mt-3 grid gap-2 text-[14.5px] sm:grid-cols-[14rem_1fr]">
                <dt className="font-semibold text-muted">Useful</dt><dd>{FEEDBACK_TEXT[data.feedback.useful]}</dd>
                <dt className="font-semibold text-muted">Made sense</dt><dd>{FEEDBACK_TEXT[data.feedback.madeSense]}</dd>
                <dt className="font-semibold text-muted">Missing</dt><dd className="whitespace-pre-wrap">{data.feedback.missing || "—"}</dd>
                <dt className="font-semibold text-muted">Confusing or incorrect</dt><dd className="whitespace-pre-wrap">{data.feedback.confusing || "—"}</dd>
                <dt className="font-semibold text-muted">Wants help</dt><dd>{data.feedback.wantsHelp ? "Yes" : "No"}</dd>
                <dt className="font-semibold text-muted">Received</dt><dd>{nzDateTime(data.feedbackAt)}</dd>
              </dl>
            )}
          </section>
        </div>
      )}

      {tab === "plan" && (
        <div className="mt-5 space-y-5">
          {data.releasedDiffers && <p className="rounded-lg bg-brand-soft p-3 text-[14px] text-brand">The family currently sees the version released on {nzDate(data.releasedAt)}. Edits here reach them only when you release again.</p>}
          <Box title="Introduction"><Text value={plan.intro} onChange={(v) => edit({ ...plan, intro: v })} rows={3} label="Introduction" /></Box>
          {plan.urgent && (
            <Box title="Urgent attention" tone="now">
              <Lines value={plan.urgent.items} onChange={(v) => edit({ ...plan, urgent: { ...plan.urgent!, items: v } })} label="Urgent items, one per line" />
              <Text value={plan.urgent.guidance} onChange={(v) => edit({ ...plan, urgent: { ...plan.urgent!, guidance: v } })} rows={3} label="Guidance" />
            </Box>
          )}
          <Box title="A. Your current situation"><Lines value={plan.situation} onChange={(v) => edit({ ...plan, situation: v })} label="One sentence per line" /></Box>
          <Box title="B. What matters most"><Lines value={plan.matters} onChange={(v) => edit({ ...plan, matters: v })} label="One sentence per line" /></Box>
          <Box title="C. Likely pathway">
            {plan.pathways.length === 0 && <Text value={plan.pathwayNote} onChange={(v) => edit({ ...plan, pathwayNote: v })} rows={3} label="Shown when no pathway applies" />}
            {plan.pathways.map((p, i) => (
              <div key={p.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{PATHWAY_LABEL[p.id]}</p>
                  <button className="btn-ghost !min-h-0 !px-2 !py-1" onClick={() => edit({ ...plan, pathways: plan.pathways.filter((_, n) => n !== i) })}><X size={14} aria-hidden="true" />Remove</button></div>
                <Input value={p.name} onChange={(v) => edit({ ...plan, pathways: plan.pathways.map((x, n) => (n === i ? { ...x, name: v } : x)) })} label="Heading" />
                <Text value={p.explanation} onChange={(v) => edit({ ...plan, pathways: plan.pathways.map((x, n) => (n === i ? { ...x, explanation: v } : x)) })} rows={3} label="Explanation" />
              </div>
            ))}
          </Box>

          <Box title={`D. Priority actions (${plan.actions.length - removedCount}${removedCount ? `, ${removedCount} removed` : ""})`}>
            {plan.actions.map((a) => (
              <div key={a.key} className={clsx("rounded-lg border p-3", a.removed ? "border-dashed border-line bg-paper opacity-70" : "border-line bg-white")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12.5px] text-muted">{a.topic} · <span className="font-mono">{a.key}</span></span>
                  <div className="flex items-center gap-2">
                    {!a.removed && <select aria-label="Priority" className="field !min-h-[32px] !w-auto !py-1" value={a.priority} onChange={(e) => editAction(a.key, { priority: e.target.value as PlanAction["priority"] })}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>}
                    <button className="btn-ghost !min-h-0 !px-2 !py-1" onClick={() => editAction(a.key, { removed: !a.removed })}>{a.removed ? <><Undo2 size={14} aria-hidden="true" />Restore</> : <><X size={14} aria-hidden="true" />Remove</>}</button>
                  </div>
                </div>
                {a.removed ? <p className="mt-1 text-[14px] line-through">{a.title}</p> : (
                  <div className="mt-2 grid gap-2.5">
                    <Input value={a.title} onChange={(v) => editAction(a.key, { title: v })} label="What to do" />
                    <Text value={a.why} onChange={(v) => editAction(a.key, { why: v })} rows={2} label="Why it matters" />
                    <Text value={a.nextStep} onChange={(v) => editAction(a.key, { nextStep: v })} rows={2} label="Next step" />
                    <div className="grid gap-2.5 md:grid-cols-2">
                      <Lines value={a.whoCanHelp} onChange={(v) => editAction(a.key, { whoCanHelp: v })} label="Who can help" />
                      <Lines value={a.prepare} onChange={(v) => editAction(a.key, { prepare: v })} label="What to prepare" />
                      <Lines value={a.questions} onChange={(v) => editAction(a.key, { questions: v })} label="Questions to ask" />
                      <Lines value={a.check} onChange={(v) => editAction(a.key, { check: v })} label="Things to check" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Box>

          {(["funding", "check", "professional"] as const).map((section) => plan.information.some((i) => i.section === section) && (
            <Box key={section} title={INFO_TITLE[section]}>
              {plan.information.filter((i) => i.section === section).map((i) => (
                <div key={i.id} className={clsx("rounded-lg border p-3", i.removed ? "border-dashed border-line opacity-70" : "border-line")}>
                  <div className="flex justify-end"><button className="btn-ghost !min-h-0 !px-2 !py-1" onClick={() => editInfo(i.id, { removed: !i.removed })}>{i.removed ? <><Undo2 size={14} aria-hidden="true" />Restore</> : <><X size={14} aria-hidden="true" />Remove</>}</button></div>
                  {i.removed ? <p className="text-[14px] line-through">{i.title || i.text}</p> : <><Input value={i.title} onChange={(v) => editInfo(i.id, { title: v })} label="Title" /><Text value={i.text} onChange={(v) => editInfo(i.id, { text: v })} rows={3} label="Text" /></>}
                </div>
              ))}
            </Box>
          ))}

          <Box title="J. Help from Ageing Navigator"><Text value={plan.cta} onChange={(v) => edit({ ...plan, cta: v })} rows={2} label="Invitation" /></Box>
          <Box title="Internal note (never shown to the family)"><Text value={note} onChange={(v) => { setNote(v); setDirty(true); }} rows={3} label="Note" /></Box>

          {preview && (
            <section className="card p-5 sm:p-7" aria-label="Preview">
              <p className="eyebrow mb-4">Preview: what the family will see</p>
              <style>{PLAN_CSS(".anplan")}</style>
              <div className="anplan text-[15px]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </section>
          )}

          <Box title="Other actions">
            <div className="flex flex-wrap gap-2">
              {data.hasReleased && <a className="btn-outline" href={`/api/admin/cases/${data.id}/pdf?which=released`}><FileDown size={15} aria-hidden="true" />Released PDF</a>}
              {(data.hasReleased || released) && !closed && <button className="btn-outline" disabled={!!busy} onClick={() => void newLink(true)}>{busy === "resend" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}Email a new link</button>}
              {(data.hasReleased || released) && !closed && <button className="btn-outline" disabled={!!busy} onClick={() => void newLink(false)}><Copy size={15} aria-hidden="true" />New link to copy</button>}
              <button className="btn-outline" disabled={!!busy} onClick={() => void regenerate()}><RefreshCw size={15} aria-hidden="true" />Regenerate from answers</button>
              <button className="btn-outline" disabled={!!busy} onClick={() => void setClosed(!closed)}>{closed ? <><RotateCcw size={15} aria-hidden="true" />Reopen</> : <><Check size={15} aria-hidden="true" />Close case</>}</button>
            </div>
            <div className="mt-5 rounded-lg border border-now/30 p-3">
              <p className="text-[14px] font-semibold text-now">Delete this case now</p>
              <p className="text-[13.5px] text-muted">Deletes the answers, plans, link, requests and feedback. It cannot be undone. Type <span className="font-mono font-bold">{data.reference}</span> to confirm.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input className="field !w-44" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} aria-label="Type the reference to confirm" />
                <button className="btn !bg-now text-white" disabled={deleteText.trim().toUpperCase() !== data.reference || !!busy} onClick={() => void remove()}><Trash2 size={15} aria-hidden="true" />Delete</button>
              </div>
            </div>
          </Box>
        </div>
      )}

      {/* ---------- action bar ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="wrap flex flex-wrap items-center gap-2 py-2.5">
          <button className="btn-primary" disabled={!dirty || !!busy} onClick={() => void save()}>{busy === "save" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{dirty ? "Save changes" : "Saved"}</button>
          <button className="btn-outline" onClick={() => { setTab("plan"); setPreview(!preview); }}><Eye size={15} aria-hidden="true" />{preview ? "Hide preview" : "Preview"}</button>
          <a className="btn-outline" href={`/api/admin/cases/${data.id}/pdf`} onClick={(e) => { if (dirty) { e.preventDefault(); setMessage({ kind: "error", text: "Save your changes first, then open the PDF preview." }); } }}><FileDown size={15} aria-hidden="true" /><span className="hidden sm:inline">PDF preview</span><span className="sm:hidden">PDF</span></a>
          {!closed && (confirmRelease ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-2 py-1 text-[13.5px]">
              {data.hasReleased ? "Release again and send a new link?" : `Release to ${data.contact.email}?`}
              <button className="btn-primary !min-h-[32px]" disabled={!!busy} onClick={() => void releaseNow()}>{busy === "release" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}Yes, release</button>
              <button className="btn-ghost !min-h-[32px]" onClick={() => setConfirmRelease(false)}>Cancel</button>
            </span>
          ) : <button className="btn-primary ml-auto" disabled={!!busy} onClick={() => setConfirmRelease(true)}><Send size={15} aria-hidden="true" />{data.hasReleased || released ? "Release again" : "Approve and release"}</button>)}
          {message && <p role={message.kind === "error" ? "alert" : "status"} className={clsx("w-full text-[13.5px] font-semibold", message.kind === "error" ? "text-now" : "text-ahead")}>{message.text}</p>}
        </div>
      </div>
    </div>
  );
}

function Box({ title, tone, children }: { title: string; tone?: "now"; children: React.ReactNode }) {
  return <section className={clsx("card p-4 sm:p-5", tone === "now" && "border-now")}><h2 className={clsx("mb-3 text-[17px]", tone === "now" && "text-now")}>{title}</h2><div className="grid gap-3">{children}</div></section>;
}

function Input({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  return <div><label htmlFor={id} className="label">{label}</label><input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Text({ value, onChange, label, rows = 2 }: { value: string; onChange: (v: string) => void; label: string; rows?: number }) {
  const id = useId();
  return <div><label htmlFor={id} className="label">{label}</label><textarea id={id} className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

/** A list edited as one item per line. Keeps the raw text while typing, so a new empty line is not swallowed. */
function Lines({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const id = useId();
  const [text, setText] = useState(value.join("\n"));
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="field" rows={Math.max(2, Math.min(8, value.length + 1))} value={text}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)); }} />
    </div>
  );
}
