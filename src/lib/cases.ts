import { db, jsonb, type Db } from "./db";
import { addMonths, config } from "./config";
import { newReference } from "./secrets";
import { type CaseStatus, type Feedback, type RequestStatus } from "./case-status";
import type { Answers } from "./questionnaire/schema";
import type { PilotPlan } from "./pilot/plan";

export { STATUS_LABEL, type CaseStatus, type Feedback } from "./case-status";

/**
 * Cases: one family's questionnaire, their plan in its three states, their link, requests and feedback.
 * Every change is written together with its row in `events` (one transaction), which holds no personal data and
 * survives deletion, so the pilot can still be counted after cases are deleted. Each function takes an optional
 * `d` so a caller can combine several of them in one transaction.
 */

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
  bestTime: string; message: string; status: RequestStatus;
};

type Row = Record<string, unknown>;
const date = (v: unknown) => (v == null ? null : v instanceof Date ? v : new Date(String(v)));
/** jsonb columns come back parsed from both drivers. A string here means a value was stored double-encoded: fail loudly. */
function fromJson<T>(v: unknown, column: string): T {
  if (typeof v === "string") throw new Error(`Column ${column} holds a JSON string, not JSON: it was written double-encoded`);
  return v as T;
}
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const use = async (d?: Db) => d ?? db();

function toCase(r: Row): CaseRecord {
  return {
    id: String(r.id), reference: String(r.reference), status: r.status as CaseStatus, version: Number(r.version),
    submittedAt: date(r.submitted_at)!, reviewedAt: date(r.reviewed_at), releasedAt: date(r.released_at), closedAt: date(r.closed_at), retainUntil: date(r.retain_until)!,
    questionnaireVersion: String(r.questionnaire_version), contentVersion: String(r.content_version), consentAt: date(r.consent_at)!, marketingConsent: !!r.marketing_consent,
    contactName: String(r.contact_name), contactEmail: String(r.contact_email), contactPhone: (r.contact_phone as string) ?? null,
    personFirstName: String(r.person_first_name), personPreferredName: (r.person_preferred_name as string) ?? null,
    answers: fromJson<Answers>(r.answers, "answers"), urgent: !!r.urgent, pathways: fromJson<string[]>(r.pathways, "pathways"), referral: (r.referral as string) ?? null,
    generatedPlan: fromJson<PilotPlan>(r.generated_plan, "generated_plan"), workingPlan: fromJson<PilotPlan>(r.working_plan, "working_plan"),
    releasedPlan: r.released_plan == null ? null : fromJson<PilotPlan>(r.released_plan, "released_plan"),
    navigatorNote: String(r.navigator_note ?? ""), releaseEmailStatus: (r.release_email_status as CaseRecord["releaseEmailStatus"]) ?? null,
    feedback: r.feedback == null ? null : fromJson<Feedback>(r.feedback, "feedback"), feedbackAt: date(r.feedback_at), updatedAt: date(r.updated_at)!,
  };
}

export async function logEvent(d: Db, caseId: string | null, actor: string, type: string) {
  await d.query("insert into events (case_id, actor, type) values ($1, $2, $3)", [caseId, actor, type]);
}

export class Conflict extends Error {}
const STALE = "This case was changed by someone else. Reload to see the latest version.";

/**
 * While a navigator is working on a case that has not been released, its deletion date moves forward, so a case in
 * review is never deleted from under them. Released cases keep the date set at release.
 */
const KEEP_WHILE_WORKING = "retain_until = case when released_plan is null then greatest(retain_until, now() + make_interval(days => $_days)) else retain_until end";
const keepWhileWorking = (paramIndex: number) => KEEP_WHILE_WORKING.replace("$_days", `$${paramIndex}`);

/* ------------------------------ family side ------------------------------ */

export type NewCase = {
  submissionId?: string;
  answers: Answers; contact: { name: string; email: string; phone?: string }; person: { firstName: string; preferredName?: string };
  consentAt: Date; marketingConsent: boolean; referral?: string; urgent: boolean; pathways: string[]; plan: PilotPlan;
  questionnaireVersion: string; contentVersion: string;
};

const isUniqueViolation = (e: unknown, what: string) => {
  const err = e as { code?: string; message?: string; constraint_name?: string; constraint?: string };
  return err.code === "23505" && `${err.constraint_name ?? ""} ${err.constraint ?? ""} ${err.message ?? ""}`.includes(what);
};

/**
 * Store a submitted questionnaire. With a `submissionId`, a repeated submission (the family pressed again after a
 * dropped connection) returns the case it already created instead of making a second one.
 */
export async function createCase(input: NewCase, now = new Date(), d?: Db): Promise<{ id: string; reference: string; created: boolean }> {
  const q = await use(d);
  for (let attempt = 0; ; attempt++) {
    try {
      return await q.tx(async (t) => {
        const [row] = await t.query<{ id: string; reference: string }>(
          `insert into cases (reference, submission_id, submitted_at, retain_until, questionnaire_version, content_version, consent_at, marketing_consent,
             contact_name, contact_email, contact_phone, person_first_name, person_preferred_name, answers, urgent, pathways, referral, generated_plan, working_plan)
           values ($1, $2, $3, $3::timestamptz + make_interval(days => $4), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
           on conflict (submission_id) do nothing returning id, reference`,
          [newReference(), input.submissionId ?? null, now.toISOString(), config.retentionDaysUnreleased(), input.questionnaireVersion, input.contentVersion,
            input.consentAt.toISOString(), input.marketingConsent, input.contact.name, input.contact.email, input.contact.phone || null,
            input.person.firstName, input.person.preferredName || null, jsonb(input.answers), input.urgent, jsonb(input.pathways),
            input.referral || null, jsonb(input.plan)],
        );
        if (!row) {
          const [existing] = await t.query<{ id: string; reference: string }>("select id, reference from cases where submission_id = $1", [input.submissionId ?? null]);
          return { ...existing, created: false };
        }
        await logEvent(t, row.id, "family", input.urgent ? "submitted_urgent" : "submitted");
        return { id: row.id, reference: row.reference, created: true };
      });
    } catch (e) {
      if (attempt < 3 && isUniqueViolation(e, "reference")) continue;
      throw e;
    }
  }
}

export type LinkedCase = CaseRecord & { linkId: string; linkExpiresAt: Date; releasedPlan: PilotPlan };

/** The case behind a private link, if the link is current and the plan was released. */
export async function caseByTokenHash(tokenHash: string, d?: Db): Promise<LinkedCase | null> {
  const q = await use(d);
  const [r] = await q.query(
    `select c.*, l.id as link_id, l.expires_at as link_expires_at from family_links l join cases c on c.id = l.case_id
     where l.token_hash = $1 and l.revoked_at is null and l.expires_at > now() and c.released_plan is not null`, [tokenHash]);
  if (!r) return null;
  await q.query("update family_links set last_viewed_at = now() where id = $1", [String(r.link_id)]);
  return { ...toCase(r), linkId: String(r.link_id), linkExpiresAt: date(r.link_expires_at)! } as LinkedCase;
}

export async function addRequest(caseId: string, input: Omit<ImplementationRequest, "id" | "caseId" | "createdAt" | "status">, d?: Db): Promise<string> {
  return (await use(d)).tx(async (t) => {
    const [row] = await t.query<{ id: string }>(
      "insert into implementation_requests (case_id, services, contact_method, phone, best_time, message) values ($1, $2, $3, $4, $5, $6) returning id",
      [caseId, jsonb(input.services), input.contactMethod, input.phone || null, input.bestTime, input.message]);
    await logEvent(t, caseId, "family", "implementation_requested");
    return row.id;
  });
}

export async function saveFeedback(caseId: string, feedback: Feedback, d?: Db) {
  await (await use(d)).tx(async (t) => {
    await t.query("update cases set feedback = $2, feedback_at = now(), updated_at = now() where id = $1", [caseId, jsonb(feedback)]);
    await logEvent(t, caseId, "family", "feedback");
  });
}

/* ------------------------------ navigator side ------------------------------ */

export type ListFilter = "open" | "released" | "closed" | "all";
export const LIST_FILTERS: Record<ListFilter, CaseStatus[] | null> = { open: ["submitted", "in_review"], released: ["released"], closed: ["closed"], all: null };

export async function listCases(filter: ListFilter, d?: Db): Promise<CaseSummary[]> {
  const statuses = LIST_FILTERS[filter];
  const rows = await (await use(d)).query(
    `select c.id, c.reference, c.status, c.submitted_at, c.released_at, c.urgent, c.pathways, c.referral, c.contact_name,
       coalesce(c.person_preferred_name, c.person_first_name) as person_name, c.feedback is not null as has_feedback,
       (select count(*)::int from implementation_requests r where r.case_id = c.id and r.status = 'new') as open_requests
     from cases c where ($1::text is null or c.status = any(string_to_array($1::text, ',')))
     order by ${filter === "open" ? "c.urgent desc, " : ""}c.submitted_at desc limit 500`, [statuses ? statuses.join(",") : null]);
  return rows.map((r) => ({
    id: String(r.id), reference: String(r.reference), status: r.status as CaseStatus, submittedAt: date(r.submitted_at)!, releasedAt: date(r.released_at),
    urgent: !!r.urgent, pathways: fromJson<string[]>(r.pathways, "pathways"), referral: (r.referral as string) ?? null, contactName: String(r.contact_name),
    personName: String(r.person_name), openRequests: Number(r.open_requests), hasFeedback: !!r.has_feedback,
  }));
}

export async function counts(d?: Db): Promise<Record<ListFilter, number>> {
  const [r] = await (await use(d)).query<Record<string, number>>(
    `select count(*) filter (where status in ('submitted', 'in_review'))::int as open, count(*) filter (where status = 'released')::int as released,
       count(*) filter (where status = 'closed')::int as closed, count(*)::int as "all" from cases`);
  return { open: Number(r.open), released: Number(r.released), closed: Number(r.closed), all: Number(r.all) };
}

export async function getCase(id: string, d?: Db): Promise<CaseRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await (await use(d)).query("select * from cases where id = $1", [id]);
  return r ? toCase(r) : null;
}

/** First look by a navigator moves a new case into review. */
export async function markOpened(id: string, navigatorId: string, d?: Db) {
  await (await use(d)).tx(async (t) => {
    const rows = await t.query(
      `update cases set status = 'in_review', reviewed_at = now(), reviewed_by = $2, updated_at = now(), ${keepWhileWorking(3)}
       where id = $1 and status = 'submitted' returning id`, [id, navigatorId, config.retentionDaysUnreleased()]);
    if (rows.length) await logEvent(t, id, navigatorId, "opened");
  });
}

/** Save edits, only if nobody else saved since `version` was read, and not on a closed case. Returns the new version. */
export async function saveWorking(id: string, version: number, plan: PilotPlan, note: string, navigatorId: string, d?: Db): Promise<number> {
  return (await use(d)).tx(async (t) => {
    const [r] = await t.query<{ version: number }>(
      `update cases set working_plan = $3, navigator_note = $4, version = version + 1, updated_at = now(),
         status = case when status = 'submitted' then 'in_review' else status end,
         reviewed_at = coalesce(reviewed_at, now()), reviewed_by = coalesce(reviewed_by, $5), ${keepWhileWorking(6)}
       where id = $1 and version = $2 and status <> 'closed' returning version`,
      [id, version, jsonb(plan), note, navigatorId, config.retentionDaysUnreleased()]);
    if (!r) throw new Conflict(STALE);
    await logEvent(t, id, navigatorId, "edited");
    return Number(r.version);
  });
}

/** Replace the plan with a freshly generated one (after a content update). Edits are discarded. */
export async function regenerate(id: string, version: number, plan: PilotPlan, pathways: string[], urgent: boolean, navigatorId: string, d?: Db): Promise<number> {
  return (await use(d)).tx(async (t) => {
    const [r] = await t.query<{ version: number }>(
      `update cases set generated_plan = $3, working_plan = $3, pathways = $4, urgent = $5, content_version = $6,
         version = version + 1, updated_at = now(), ${keepWhileWorking(7)}
       where id = $1 and version = $2 and status <> 'closed' returning version`,
      [id, version, jsonb(plan), jsonb(pathways), urgent, plan.contentVersion, config.retentionDaysUnreleased()]);
    if (!r) throw new Conflict(STALE);
    await logEvent(t, id, navigatorId, "regenerated");
    return Number(r.version);
  });
}

async function newLink(t: Db, id: string, tokenHash: string, expires: Date) {
  await t.query("update family_links set revoked_at = now() where case_id = $1 and revoked_at is null", [id]);
  await t.query("insert into family_links (case_id, token_hash, expires_at) values ($1, $2, $3)", [id, tokenHash, expires.toISOString()]);
}

/**
 * Release: freeze the working plan as what the family sees, replace any earlier link, and keep the case until
 * `retainUntil`. The caller creates the token and sends the email.
 */
export async function release(id: string, version: number, tokenHash: string, navigatorId: string, now = new Date(), d?: Db): Promise<{ version: number; retainUntil: Date }> {
  const retainUntil = addMonths(now, config.retentionMonthsAfterRelease());
  return (await use(d)).tx(async (t) => {
    const [r] = await t.query<{ version: number }>(
      `update cases set released_plan = working_plan, status = 'released', released_at = $3, released_by = $4, retain_until = $5,
         release_email_status = null, version = version + 1, updated_at = now()
       where id = $1 and version = $2 and status <> 'closed' returning version`,
      [id, version, now.toISOString(), navigatorId, retainUntil.toISOString()]);
    if (!r) throw new Conflict("This case was changed by someone else, or it is closed. Reload and try again.");
    await newLink(t, id, tokenHash, retainUntil);
    await logEvent(t, id, navigatorId, "released");
    return { version: Number(r.version), retainUntil };
  });
}

export async function setReleaseEmailStatus(id: string, status: "sent" | "failed", d?: Db) {
  await (await use(d)).tx(async (t) => {
    await t.query("update cases set release_email_status = $2, updated_at = now() where id = $1", [id, status]);
    await logEvent(t, id, "system", `release_email_${status}`);
  });
}

/** A new link for the same released plan, when the family lost the email or it bounced. The old link stops working. */
export async function replaceLink(id: string, tokenHash: string, navigatorId: string, d?: Db): Promise<Date> {
  return (await use(d)).tx(async (t) => {
    const [c] = await t.query<{ retain_until: Date }>("select retain_until from cases where id = $1 and released_plan is not null and status <> 'closed' for update", [id]);
    if (!c) throw new Conflict("Only a released plan on an open case has a link.");
    const expires = date(c.retain_until)!;
    await newLink(t, id, tokenHash, expires);
    await logEvent(t, id, navigatorId, "link_replaced");
    return expires;
  });
}

/** Close or reopen. Checks the version like an edit, and returns the new one. */
export async function setClosed(id: string, version: number, closed: boolean, navigatorId: string, d?: Db): Promise<number> {
  return (await use(d)).tx(async (t) => {
    const [r] = await t.query<{ version: number }>(
      closed
        ? "update cases set status = 'closed', closed_at = now(), version = version + 1, updated_at = now() where id = $1 and version = $2 and status <> 'closed' returning version"
        : `update cases set status = case when released_plan is null then 'in_review' else 'released' end, closed_at = null, version = version + 1, updated_at = now(), ${keepWhileWorking(3)}
           where id = $1 and version = $2 and status = 'closed' returning version`,
      closed ? [id, version] : [id, version, config.retentionDaysUnreleased()]);
    if (!r) throw new Conflict(STALE);
    await logEvent(t, id, navigatorId, closed ? "closed" : "reopened");
    return Number(r.version);
  });
}

/** Delete now. Returns false when the case was already gone, and then records nothing. */
export async function deleteCase(id: string, actor: string, d?: Db): Promise<boolean> {
  return (await use(d)).tx(async (t) => {
    const gone = await t.query("delete from cases where id = $1 returning id", [id]);
    if (gone.length) await logEvent(t, null, actor, "deleted");
    return gone.length > 0;
  });
}

export async function listRequests(caseId: string, d?: Db): Promise<ImplementationRequest[]> {
  const rows = await (await use(d)).query("select * from implementation_requests where case_id = $1 order by created_at desc", [caseId]);
  return rows.map((r) => ({
    id: String(r.id), caseId: String(r.case_id), createdAt: date(r.created_at)!, services: fromJson<string[]>(r.services, "services"), contactMethod: r.contact_method as "phone" | "email",
    phone: (r.phone as string) ?? null, bestTime: String(r.best_time ?? ""), message: String(r.message ?? ""), status: r.status as RequestStatus,
  }));
}

export async function setRequestStatus(requestId: string, status: RequestStatus, navigatorId: string, d?: Db): Promise<boolean> {
  if (!isUuid(requestId)) return false;
  return (await use(d)).tx(async (t) => {
    const [r] = await t.query<{ case_id: string }>("update implementation_requests set status = $2, updated_at = now() where id = $1 returning case_id", [requestId, status]);
    if (r) await logEvent(t, r.case_id, navigatorId, `request_${status}`);
    return !!r;
  });
}

/**
 * Retention: delete every case past its date in one statement, so a case released a moment ago (its date just moved
 * a year on) can never be caught between choosing and deleting. Links and requests go with it; one anonymous event
 * per case stays. Expired rate-limit windows (at most a day long) are cleared too, so no pseudonym is kept longer.
 */
export async function purgeExpired(now = new Date(), d?: Db): Promise<number> {
  return (await use(d)).tx(async (t) => {
    const rows = await t.query(
      `with gone as (delete from cases where retain_until < $1 returning id)
       insert into events (case_id, actor, type) select null, 'system', 'deleted_expired' from gone returning id`, [now.toISOString()]);
    await t.query("delete from rate_limits where window_start < $1::timestamptz - interval '1 day'", [now.toISOString()]);
    return rows.length;
  });
}

/** Everything the pilot evaluation needs, with contact details and free text left out. */
export async function exportRows(d?: Db) {
  return (await use(d)).query(
    `select c.reference, c.status, c.submitted_at, c.reviewed_at, c.released_at, c.closed_at, c.urgent, c.pathways, c.referral,
       c.questionnaire_version, c.content_version, c.marketing_consent, c.answers, c.feedback, c.release_email_status,
       (select count(*)::int from implementation_requests r where r.case_id = c.id) as requests,
       (select coalesce(jsonb_agg(s), '[]'::jsonb) from implementation_requests r, jsonb_array_elements_text(r.services) s where r.case_id = c.id) as requested_services,
       (select string_agg(r.status, ' ') from implementation_requests r where r.case_id = c.id) as request_status
     from cases c order by c.submitted_at`);
}
