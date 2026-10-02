import { config } from "./config";
import { log } from "./log";
import { esc } from "./pilot/render";
import { BRAND } from "./brand";
import { navigatorEmails } from "./navigators";
import { db } from "./db";
import { logEvent } from "./cases";

/**
 * Email. With RESEND_API_KEY set, mail goes through Resend's HTTP API from the client's verified domain. Without it
 * (local development and tests) messages are kept in an in-memory outbox, so nothing leaves the machine.
 * Emails carry links and case references, never health information.
 */

export type Email = { to: string[]; subject: string; text: string; html: string };
type Result = { ok: true } | { ok: false; error: string };
type Transport = (e: Email) => Promise<Result>;

const g = globalThis as unknown as { __anOutbox?: Email[]; __anTransport?: Transport };
export const outbox = () => (g.__anOutbox ??= []);
/** Tests can make sending fail, or capture messages. */
export function setTransport(t: Transport | undefined) { g.__anTransport = t; }

async function viaResend(e: Email): Promise<Result> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.emailFrom(), to: e.to, subject: e.subject, text: e.text, html: e.html, ...(config.emailReplyTo() ? { reply_to: config.emailReplyTo() } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "error" };
  }
}

/**
 * Without RESEND_API_KEY: on a local machine (no real database) messages go to the in-memory outbox; anywhere with real
 * data (Vercel, or a DATABASE_URL) nothing can be sent, and saying so lets the navigator copy the link instead.
 */
const unsent: Transport = async () => ({ ok: false, error: "email_not_configured" });
const local: Transport = async (m) => { outbox().push(m); return { ok: true }; };

const realData = () => !!process.env.VERCEL || !!process.env.DATABASE_URL;

/** False where real data is but no email service is set up yet: the review screen then says so instead of "failed". */
export const emailReady = () => !!g.__anTransport || !!process.env.RESEND_API_KEY || !realData();

export async function sendEmail(e: Email): Promise<boolean> {
  if (!e.to.length) { log("email", { kind: e.subject.slice(0, 40), ok: false, code: "no_recipients" }); return false; }
  const transport: Transport = g.__anTransport ?? (process.env.RESEND_API_KEY ? viaResend : realData() ? unsent : local);
  const r = await transport(e);
  log("email", { kind: e.subject.slice(0, 40), ok: r.ok, code: r.ok ? undefined : r.error, count: e.to.length });
  return r.ok;
}

/* ------------------------------ messages ------------------------------ */

const paragraphs = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function layout(bodyHtml: string) {
  const c = BRAND.colors;
  return `<!doctype html><html><body style="margin:0;background:${c.sand};font-family:Arial,sans-serif;color:${c.ink}">
<div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:10px;padding:24px;line-height:1.55;font-size:15px">
<p style="margin:0 0 16px;font-weight:bold;color:${c.brand}">${esc(BRAND.name)}</p>${bodyHtml}</div></div></body></html>`;
}

/** The family's email on release. The wording is the client's (Texts: email_release_*), with {{link}} and {{expires}}. */
export function releaseEmail(texts: Record<string, string>, to: string, link: string, expires: Date): Email {
  const expiresText = expires.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });
  const fill = (s: string) => s.replaceAll("{{link}}", link).replaceAll("{{expires}}", expiresText);
  const text = fill(texts.email_release_body);
  const html = paragraphs(texts.email_release_body).map((p) => {
    if (p.includes("{{link}}")) {
      const [before, after] = p.split("{{link}}");
      return `<p>${esc(fill(before))}<br><a href="${esc(link)}" style="display:inline-block;margin-top:8px;background:${BRAND.colors.brand};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open your plan</a>${esc(fill(after))}</p>`;
    }
    return `<p>${esc(fill(p)).replace(/\n/g, "<br>")}</p>`;
  }).join("");
  return { to: [to], subject: texts.email_release_subject, text, html: layout(html) };
}

/**
 * To every active navigator: a case reference and a link to the case, nothing about the family. Best effort: it
 * never fails the request that triggered it (the family's case is already stored). The outcome is recorded on the
 * case's events, so a notification that did not go out can be found.
 */
export async function notifyNavigators(subject: string, lines: string[], caseId: string): Promise<boolean> {
  let sent = false;
  try {
    const link = `${config.appUrl()}/admin/cases/${caseId}`;
    const text = [...lines, "", `Open the case: ${link}`].join("\n");
    const html = layout(`${lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p><a href="${esc(link)}">Open the case</a></p>`);
    sent = await sendEmail({ to: await navigatorEmails(), subject, text, html });
  } catch { sent = false; }
  try { await logEvent(await db(), caseId, "system", sent ? "navigators_notified" : "navigators_notify_failed"); } catch { /* the event is a record, not a requirement */ }
  return sent;
}
