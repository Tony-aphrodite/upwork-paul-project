import type { Questionnaire } from "./questionnaire/schema";
import type { Feedback } from "./cases";

/**
 * CSV for the pilot evaluation. One row per case, one column per choice question (option values joined by "|"),
 * with contact details and all free text left out. Cells that a spreadsheet could read as a formula are prefixed
 * with an apostrophe.
 */
export function cell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = Record<string, unknown>;
const parse = <T,>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;

export function casesCsv(rows: Row[], doc: Questionnaire): string {
  const questions = doc.sections.flatMap((s) => s.questions).filter((q) => q.type === "single" || q.type === "multi" || q.type === "tri_grid");
  const answerCols = questions.flatMap((q) => (q.type === "tri_grid" ? q.items.map((i) => ({ key: `${q.id}.${i.id}`, q: q.id, item: i.id })) : [{ key: q.id, q: q.id, item: undefined as string | undefined }]));
  const head = [
    "reference", "status", "submitted_at", "reviewed_at", "released_at", "closed_at", "urgent", "pathways", "referral",
    "questionnaire_version", "content_version", "marketing_consent", "release_email", "requests", "requested_services", "request_status",
    "feedback_useful", "feedback_made_sense", "feedback_wants_help", "feedback_gave_comments",
    ...answerCols.map((c) => c.key),
  ];
  const lines = [head.join(",")];
  for (const r of rows) {
    const answers = parse<Record<string, unknown>>(r.answers) ?? {};
    const fb = r.feedback == null ? null : parse<Feedback>(r.feedback);
    const services = [...new Set(parse<string[][]>(r.requested_services ?? "[]").flat())];
    const values = [
      r.reference, r.status, r.submitted_at, r.reviewed_at, r.released_at, r.closed_at, r.urgent ? "yes" : "no",
      parse<string[]>(r.pathways ?? "[]").join("|"), r.referral, r.questionnaire_version, r.content_version, r.marketing_consent ? "yes" : "no",
      r.release_email_status, r.requests, services.join("|"), r.request_status,
      fb?.useful, fb?.madeSense, fb ? (fb.wantsHelp ? "yes" : "no") : "", fb ? (fb.missing || fb.confusing ? "yes" : "no") : "",
      ...answerCols.map((c) => {
        const a = answers[c.q];
        if (c.item) return a && typeof a === "object" ? (a as Record<string, string>)[c.item] : "";
        return Array.isArray(a) ? a.join("|") : a;
      }),
    ];
    lines.push(values.map(cell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
