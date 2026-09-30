import { db, type Db } from "./db";
import { addDays, addMonths, config } from "./config";
import { newReference } from "./secrets";
import type { Answers } from "./questionnaire/schema";
import type { PilotPlan } from "./pilot/plan";

/**
 * Cases: one family's questionnaire, their plan in its three states, their link, requests and feedback.
 * Every change that matters is also written to `events`, which holds no personal data and survives deletion,
 * so the pilot can still be counted after cases are deleted.
 */

export type CaseStatus = "submitted" | "in_review" | "released" | "closed";
export const STATUS_LABEL: Record<CaseStatus, string> = { submitted: "New", in_review: "In review", released: "Released", closed: "Closed" };

export type Feedback = { useful: "very" | "somewhat" | "not_really"; madeSense: "yes" | "partly" | "no"; missing: string; confusing: string; wantsHelp: boolean };

export type CaseRecord = {
  id: string; reference: string; status: CaseStatus; version: number;
  submittedAt: Date; reviewedAt: Date | null; releasedAt: Date | null; closedAt: Date | null; retainUntil: Date;
  questionnaireVersion: string; contentVersion: string; consentAt: Date; marketingConsent: boolean;
  contactName: string; contactEmail: string; contactPhone: string | null;
  personFirstName: string; personPreferredName: string | null;
  answers: Answers; urgent: boolean; pathways: string[]; referral: string | null;
  generatedPlan: PilotPlan; workingPlan: PilotPlan; releasedPlan: PilotPlan | null;
  navigatorNote: string; releaseEmailStatus: "sent" | "failed" | null;
  feedback: Feedback | null; feedbackAt: Date | null; updatedAt: Date;
};

export type CaseSummary = {
  id: string; reference: string; status: CaseStatus; submittedAt: Date; releasedAt: Date | null; urgent: boolean;
  pathways: string[]; referral: string | null; contactName: string; personName: string; openRequests: number; hasFeedback: boolean;
};

export type ImplementationRequest = {
  id: string; caseId: string; createdAt: Date; services: string[]; contactMethod: "phone" | "email"; phone: string | null;
  bestTime: string; message: string; status: "new" | "contacted" | "closed";
};

type RowOf = Record<string, unknown>;
const date = (v: unknown) => (v == null ? null : v instanceof Date ? v : new Date(String(v)));
const json = <T,>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function toCase(r: RowOf): CaseRecord {
  return {
    id: String(r.id), reference: String(r.reference), status: r.status as CaseStatus, version: Number(r.version),
    submittedAt: date(r.submitted_at)!, reviewedAt: date(r.reviewed_at), releasedAt: date(r.released_at), closedAt: date(r.closed_at), retainUntil: date(r.retain_until)!,
    questionnaireVersion: String(r.questionnaire_version), contentVersion: String(r.content_version), consentAt: date(r.consent_at)!, marketingConsent: !!r.marketing_consent,
    contactName: String(r.contact_name), contactEmail: String(r.contact_email), contactPhone: (r.contact_phone as string) ?? null,
    personFirstName: String(r.person_first_name), personPreferredName: (r.person_preferred_name as string) ?? null,
    answers: json<Answers>(r.answers), urgent: !!r.urgent, pathways: json<string[]>(r.pathways), referral: (r.referral as string) ?? null,
    generatedPlan: json<PilotPlan>(r.generated_plan), workingPlan: json<PilotPlan>(r.working_plan), releasedPlan: r.released_plan == null ? null : json<PilotPlan>(r.released_plan),
    navigatorNote: String(r.navigator_note ?? ""), releaseEmailStatus: (r.release_email_status as CaseRecord["releaseEmailStatus"]) ?? null,
    feedback: r.feedback == null ? null : json<Feedback>(r.feedback), feedbackAt: date(r.feedback_at), updatedAt: date(r.updated_at)!,
  };
}

export async function logEvent(d: Db, caseId: string | null, actor: string, type: string) {
  await d.query("insert into events (case_id, actor, type) values ($1, $2, $3)", [caseId, actor, type]);
}

/* ------------------------------ family side ------------------------------ */

export type NewCase = {
  answers: Answers; contact: { name: string; email: string; phone?: string }; person: { firstName: string; preferredName?: string };
  consentAt: Date; marketingConsent: boolean; referral?: string; urgent: boolean; pathways: string[]; plan: PilotPlan;
  questionnaireVersion: string; contentVersion: string;
};

export async function createCase(input: NewCase, now = new Date()): Promise<{ id: string; reference: string }> {
  const d = await db();
  for (let attempt = 0; ; attempt++) {
    const reference = newReference();
    try {
      const [row] = await d.query<{ id: string }>(
        `insert into cases (reference, submitted_at, retain_until, questionnaire_version, content_version, consent_at, marketing_consent,
           contact_name, contact_email, contact_phone, person_first_name, person_preferred_name, answers, urgent, pathways, referral, generated_plan, working_plan)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb, $16, $17::jsonb, $17::jsonb) returning id`,
        [reference, now.toISOString(), addDays(now, config.retentionDaysUnreleased()).toISOString(), input.questionnaireVersion, input.contentVersion,
          input.consentAt.toISOString(), input.marketingConsent, input.contact.name, input.contact.email, input.contact.phone || null,
          input.person.firstName, input.person.preferredName || null, JSON.stringify(input.answers), input.urgent, JSON.stringify(input.pathways),
          input.referral || null, JSON.stringify(input.plan)],
      );
      await logEvent(d, row.id, "family", input.urgent ? "submitted_urgent" : "submitted");
      return { id: row.id, reference };
    } catch (e) {
      if (attempt < 3 && /cases_reference_key|duplicate key/.test(String((e as Error).message))) continue;
      throw e;
    }
  }
}

export type LinkedCase = CaseRecord & { linkId: string; linkExpiresAt: Date; releasedPlan: PilotPlan };

/** The case behind a private link, if the link is current and the plan was released. */
export async function caseByTokenHash(tokenHash: string): Promise<LinkedCase | null> {
  const d = await db();
  const [r] = await d.query(
    `select c.*, l.id as link_id, l.expires_at as link_expires_at from family_links l join cases c on c.id = l.case_id
     where l.token_hash = $1 and l.revoked_at is null and l.expires_at > now() and c.released_plan is not null`, [tokenHash]);
  if (!r) return null;
  await d.query("update family_links set last_viewed_at = now() where id = $1", [r.link_id]);
  return { ...toCase(r), linkId: String(r.link_id), linkExpiresAt: date(r.link_expires_at)! } as LinkedCase;
}

export async function addRequest(caseId: string, input: Omit<ImplementationRequest, "id" | "caseId" | "createdAt" | "status">): Promise<string> {
  const d = await db();
  const [row] = await d.query<{ id: string }>(
    "insert into implementation_requests (case_id, services, contact_method, phone, best_time, message) values ($1, $2::jsonb, $3, $4, $5, $6) returning id",
    [caseId, JSON.stringify(input.services), input.contactMethod, input.phone || null, input.bestTime, input.message]);
  await logEvent(d, caseId, "family", "implementation_requested");
  return row.id;
}

export async function saveFeedback(caseId: string, feedback: Feedback) {
  const d = await db();
  await d.query("update cases set feedback = $2::jsonb, feedback_at = now() where id = $1", [caseId, JSON.stringify(feedback)]);
  await logEvent(d, caseId, "family", "feedback");
}

/* ------------------------------ navigator side ------------------------------ */

export type ListFilter = "open" | "released" | "closed" | "all";
const FILTER_SQL: Record<ListFilter, string> = {
  open: "c.status in ('submitted', 'in_review')",
  released: "c.status = 'released'",
  closed: "c.status = 'closed'",
  all: "true",
};

export async function listCases(filter: ListFilter): Promise<CaseSummary[]> {
  const d = await db();
  const rows = await d.query(
    `select c.id, c.reference, c.status, c.submitted_at, c.released_at, c.urgent, c.pathways, c.referral, c.contact_name,
       coalesce(c.person_preferred_name, c.person_first_name) as person_name, c.feedback is not null as has_feedback,
       (select count(*)::int from implementation_requests r where r.case_id = c.id and r.status = 'new') as open_requests
     from cases c where ${FILTER_SQL[filter]}
     order by ${filter === "open" ? "c.urgent desc, " : ""}c.submitted_at desc limit 500`);
  return rows.map((r) => ({
    id: String(r.id), reference: String(r.reference), status: r.status as CaseStatus, submittedAt: date(r.submitted_at)!, releasedAt: date(r.released_at),
    urgent: !!r.urgent, pathways: json<string[]>(r.pathways), referral: (r.referral as string) ?? null, contactName: String(r.contact_name),
    personName: String(r.person_name), openRequests: Number(r.open_requests), hasFeedback: !!r.has_feedback,
  }));
}

export async function counts(): Promise<Record<ListFilter, number>> {
  const d = await db();
  const [r] = await d.query<Record<string, number>>(
    `select count(*) filter (where status in ('submitted', 'in_review'))::int as open, count(*) filter (where status = 'released')::int as released,
       count(*) filter (where status = 'closed')::int as closed, count(*)::int as "all" from cases`);
  return { open: Number(r.open), released: Number(r.released), closed: Number(r.closed), all: Number(r.all) };
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await (await db()).query("select * from cases where id = $1", [id]);
  return r ? toCase(r) : null;
}

/** First look by a navigator moves a new case into review. */
export async function markOpened(id: string, navigatorId: string) {
  const d = await db();
  const rows = await d.query("update cases set status = 'in_review', reviewed_at = now(), reviewed_by = $2 where id = $1 and status = 'submitted' returning id", [id, navigatorId]);
  if (rows.length) await logEvent(d, id, navigatorId, "opened");
}

export class Conflict extends Error {}

/** Save edits, only if nobody else saved since `version` was read. Returns the new version. */
export async function saveWorking(id: string, version: number, plan: PilotPlan, note: string, navigatorId: string): Promise<number> {
  const d = await db();
  const [r] = await d.query<{ version: number }>(
    `update cases set working_plan = $3::jsonb, navigator_note = $4, version = version + 1, updated_at = now(),
       status = case when status = 'submitted' then 'in_review' else status end
     where id = $1 and version = $2 returning version`, [id, version, JSON.stringify(plan), note]);
  if (!r) throw new Conflict("This case was changed by someone else. Reload to see the latest version.");
  await logEvent(d, id, navigatorId, "edited");
  return Number(r.version);
}

/** Replace the plan with a freshly generated one (after a content update). Edits are discarded. */
export async function regenerate(id: string, version: number, plan: PilotPlan, pathways: string[], urgent: boolean, navigatorId: string): Promise<number> {
  const d = await db();
  const [r] = await d.query<{ version: number }>(
    `update cases set generated_plan = $3::jsonb, working_plan = $3::jsonb, pathways = $4::jsonb, urgent = $5, content_version = $6,
       version = version + 1, updated_at = now() where id = $1 and version = $2 returning version`,
    [id, version, JSON.stringify(plan), JSON.stringify(pathways), urgent, plan.contentVersion]);
  if (!r) throw new Conflict("This case was changed by someone else. Reload to see the latest version.");
  await logEvent(d, id, navigatorId, "regenerated");
  return Number(r.version);
}

/**
 * Release: freeze the working plan as what the family sees, replace any earlier link, and keep the case until
 * `retainUntil`. The caller creates the token and sends the email.
 */
export async function release(id: string, version: number, tokenHash: string, navigatorId: string, now = new Date()): Promise<{ version: number; retainUntil: Date }> {
  const d = await db();
  const retainUntil = addMonths(now, config.retentionMonthsAfterRelease());
  return d.tx(async (t) => {
    const [r] = await t.query<{ version: number }>(
      `update cases set released_plan = working_plan, status = 'released', released_at = $3, released_by = $4, retain_until = $5,
         release_email_status = null, version = version + 1, updated_at = now()
       where id = $1 and version = $2 and status <> 'closed' returning version`,
      [id, version, now.toISOString(), navigatorId, retainUntil.toISOString()]);
    if (!r) throw new Conflict("This case was changed by someone else, or it is closed. Reload and try again.");
    await t.query("update family_links set revoked_at = $2 where case_id = $1 and revoked_at is null", [id, now.toISOString()]);
    await t.query("insert into family_links (case_id, token_hash, expires_at) values ($1, $2, $3)", [id, tokenHash, retainUntil.toISOString()]);
    await logEvent(t, id, navigatorId, "released");
    return { version: Number(r.version), retainUntil };
  });
}

export async function setReleaseEmailStatus(id: string, status: "sent" | "failed") {
  const d = await db();
  await d.query("update cases set release_email_status = $2 where id = $1", [id, status]);
  await logEvent(d, id, "system", `release_email_${status}`);
}

/** A new link for the same released plan, when the family lost the email or it bounced. The old link stops working. */
export async function replaceLink(id: string, tokenHash: string, navigatorId: string) {
  const d = await db();
  return d.tx(async (t) => {
    const [c] = await t.query<{ retain_until: Date }>("select retain_until from cases where id = $1 and released_plan is not null", [id]);
    if (!c) throw new Conflict("Only a released plan has a link.");
    await t.query("update family_links set revoked_at = now() where case_id = $1 and revoked_at is null", [id]);
    await t.query("insert into family_links (case_id, token_hash, expires_at) values ($1, $2, $3)", [id, tokenHash, date(c.retain_until)!.toISOString()]);
    await logEvent(t, id, navigatorId, "link_replaced");
    return date(c.retain_until)!;
  });
}

export async function setClosed(id: string, closed: boolean, navigatorId: string) {
  const d = await db();
  if (closed) await d.query("update cases set status = 'closed', closed_at = now(), version = version + 1 where id = $1", [id]);
  else await d.query("update cases set status = case when released_plan is null then 'in_review' else 'released' end, closed_at = null, version = version + 1 where id = $1", [id]);
  await logEvent(d, id, navigatorId, closed ? "closed" : "reopened");
}

export async function deleteCase(id: string, actor: string, reason: "request" | "expired" = "request") {
  const d = await db();
  await d.tx(async (t) => {
    await logEvent(t, null, actor, reason === "expired" ? "deleted_expired" : "deleted");
    await t.query("delete from cases where id = $1", [id]);
  });
}

export async function listRequests(caseId: string): Promise<ImplementationRequest[]> {
  const rows = await (await db()).query("select * from implementation_requests where case_id = $1 order by created_at desc", [caseId]);
  return rows.map((r) => ({
    id: String(r.id), caseId: String(r.case_id), createdAt: date(r.created_at)!, services: json<string[]>(r.services), contactMethod: r.contact_method as "phone" | "email",
    phone: (r.phone as string) ?? null, bestTime: String(r.best_time ?? ""), message: String(r.message ?? ""), status: r.status as ImplementationRequest["status"],
  }));
}

export async function setRequestStatus(requestId: string, status: ImplementationRequest["status"], navigatorId: string): Promise<boolean> {
  if (!isUuid(requestId)) return false;
  const d = await db();
  const [r] = await d.query<{ case_id: string }>("update implementation_requests set status = $2, updated_at = now() where id = $1 returning case_id", [requestId, status]);
  if (r) await logEvent(d, r.case_id, navigatorId, `request_${status}`);
  return !!r;
}

/** Retention: delete every case past its date. Its link and requests go with it; anonymous events stay. */
export async function purgeExpired(now = new Date()): Promise<number> {
  const d = await db();
  const expired = await d.query<{ id: string }>("select id from cases where retain_until < $1", [now.toISOString()]);
  for (const { id } of expired) await deleteCase(id, "system", "expired");
  await d.query("delete from rate_limits where window_start < $1", [addDays(now, -2).toISOString()]);
  return expired.length;
}

/** Everything the pilot evaluation needs, with contact details and free text left out. */
export async function exportRows() {
  const d = await db();
  return d.query(
    `select c.reference, c.status, c.submitted_at, c.reviewed_at, c.released_at, c.closed_at, c.urgent, c.pathways, c.referral,
       c.questionnaire_version, c.content_version, c.marketing_consent, c.answers, c.feedback, c.release_email_status,
       (select count(*)::int from implementation_requests r where r.case_id = c.id) as requests,
       (select coalesce(jsonb_agg(r.services), '[]'::jsonb) from implementation_requests r where r.case_id = c.id) as requested_services,
       (select string_agg(r.status, ' ') from implementation_requests r where r.case_id = c.id) as request_status
     from cases c order by c.submitted_at`);
}
