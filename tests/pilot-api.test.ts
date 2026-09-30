import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { freshTestDb } from "./db-setup";
import { db } from "../src/lib/db";
import { setTransport, type Email } from "../src/lib/email";
import { SESSION_COOKIE, createSession } from "../src/lib/auth";
import { completeSetup, disableNavigator, issueSetupLink } from "../src/lib/navigators";
import { getCase, listCases } from "../src/lib/cases";
import { caseForToken } from "../src/lib/family-link";
import { middleware } from "../src/middleware";
import { log } from "../src/lib/log";
import { POST as submit } from "../src/app/api/submit/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as setup } from "../src/app/api/auth/setup/route";
import { PATCH as saveCase, DELETE as deleteCase } from "../src/app/api/admin/cases/[id]/route";
import { POST as releaseCase } from "../src/app/api/admin/cases/[id]/release/route";
import { POST as newLink } from "../src/app/api/admin/cases/[id]/link/route";
import { POST as closeCase } from "../src/app/api/admin/cases/[id]/close/route";
import { POST as regenerate } from "../src/app/api/admin/cases/[id]/regenerate/route";
import { PATCH as requestStatus } from "../src/app/api/admin/requests/[id]/route";
import { POST as requestHelp } from "../src/app/api/p/[token]/request/route";
import { POST as feedback } from "../src/app/api/p/[token]/feedback/route";
import { GET as retention } from "../src/app/api/cron/retention/route";
import { GET as exportCsv } from "../src/app/api/admin/export/route";
import { FAMILIES } from "./pilot-families";

const sent: Email[] = [];
let cookie = "";
let ipSeq = 0;

type Init = { method?: string; headers?: Record<string, string> };
const req = (url: string, body?: unknown, init: Init = {}) =>
  new Request(`http://x${url}`, {
    method: init.method ?? (body === undefined ? "GET" : "POST"),
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`, host: "x", ...init.headers },
  });
const asNav = (url: string, body?: unknown, method?: string, token = cookie) => req(url, body, { method, headers: { cookie: `${SESSION_COOKIE}=${token}` } });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const none = ctx({});

const submission = (i: number, extra: Record<string, unknown> = {}) => {
  const f = FAMILIES[i];
  return { answers: f.answers, contact: { name: f.person.contactName, email: f.contact.email, phone: f.contact.phone }, person: { firstName: f.person.firstName, preferredName: f.person.preferredName }, consent: true, referral: "GP-Clinic!", ...extra };
};

async function submitFamily(i: number, extra: Record<string, unknown> = {}) {
  const res = await submit(req("/api/submit", submission(i, extra)), none);
  expect(res.status).toBe(201);
  const { reference } = await res.json();
  return (await listCases("all")).find((c) => c.reference === reference)!;
}

beforeAll(async () => {
  await freshTestDb();
  setTransport(async (e) => { sent.push(e); return { ok: true }; });
  const { token } = await issueSetupLink("dee@example.test", "Dee");
  const nav = (await completeSetup(token, "a long enough password"))!;
  cookie = await createSession(nav);
});

describe("submitting the questionnaire", () => {
  it("stores the case, tells the navigators, and returns no plan", async () => {
    sent.length = 0;
    const res = await submit(req("/api/submit", submission(0)), none);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reference).toMatch(/^AN-/);
    expect(body).not.toHaveProperty("plan");
    expect(body.urgent).toBe(false);
    const c = (await listCases("all")).find((x) => x.reference === body.reference)!;
    const full = (await getCase(c.id))!;
    expect(full.referral).toBe("gp-clinic");
    expect(full.contactPhone).toBe("0123456789");
    expect(full.workingPlan.personName).toBe("Peggy");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["dee@example.test"]);
    expect(sent[0].subject).toBe(`New questionnaire ${body.reference}`);
    expect(sent[0].text).not.toMatch(/Peggy|Anna|falls/i);
  });

  it("returns the urgent guidance straight away and marks the case urgent", async () => {
    sent.length = 0;
    const body = await (await submit(req("/api/submit", submission(2)), none)).json();
    expect(body.urgent).toBe(true);
    expect(body.urgentGuidance).toMatch(/111/);
    expect(sent[0].subject).toMatch(/^URGENT/);
  });

  it("makes one case, and one email, when the same submission arrives twice", async () => {
    sent.length = 0;
    const id = "retry-0000-0000-0000-000000000001";
    const a = await (await submit(req("/api/submit", submission(1, { submissionId: id })), none)).json();
    const b = await (await submit(req("/api/submit", submission(1, { submissionId: id })), none)).json();
    expect(b.reference).toBe(a.reference);
    expect(sent).toHaveLength(1);
  });

  it("refuses missing answers with the question IDs, a missing consent and a bad email", async () => {
    const { q6, ...rest } = FAMILIES[0].answers;
    void q6;
    const res = await submit(req("/api/submit", submission(0, { answers: rest })), none);
    expect(res.status).toBe(422);
    expect((await res.json()).details.map((d: { path: string }) => d.path)).toContain("q6");
    expect((await submit(req("/api/submit", submission(0, { consent: false })), none)).status).toBe(422);
    const bad = await submit(req("/api/submit", submission(0, { contact: { name: "A", email: "not-an-email" } })), none);
    expect((await bad.json()).details.map((d: { path: string }) => d.path)).toContain("contact.email");
  });

  it("says when the questionnaire changed under a family", async () => {
    const { q6, ...rest } = FAMILIES[0].answers;
    void q6;
    const res = await submit(req("/api/submit", submission(0, { answers: rest, questionnaireVersion: "an-old-version" })), none);
    expect((await res.json()).error).toMatch(/has been updated/);
  });

  it("drops options that do not exist, and quietly ignores bots but records them", async () => {
    const before = (await listCases("all")).length;
    const bot = await submit(req("/api/submit", submission(0, { an_hp: "http://spam.example" })), none);
    expect(bot.status).toBe(201);
    expect((await listCases("all")).length).toBe(before);
    const [h] = await (await db()).query<{ n: number }>("select count(*)::int n from events where type = 'honeypot'");
    expect(h.n).toBe(1);
    expect((await submit(req("/api/submit", submission(0, { answers: { ...FAMILIES[0].answers, q8: ["falls", "<script>"], q99: "x" } })), none)).status).toBe(201);
  });

  it("counts only complete submissions towards the limit for one connection", async () => {
    const same = { headers: { "x-forwarded-for": "10.9.9.9" } };
    const { q6, ...rest } = FAMILIES[0].answers;
    void q6;
    for (let i = 0; i < 12; i++) await submit(req("/api/submit", submission(0, { answers: rest }), same), none); // mistakes do not count
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await submit(req("/api/submit", submission(1), same), none)).status);
    expect(codes.slice(0, 10).every((c) => c === 201)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});

describe("access", () => {
  const mw = (path: string, token?: string) => middleware(new NextRequest(`http://x${path}`, { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} }));
  it("keeps navigator pages and APIs behind a session", async () => {
    expect((await mw("/admin")).status).toBe(307);
    expect((await mw("/api/admin/export")).status).toBe(401);
    expect((await mw("/api/admin/export", "forged.token.value")).status).toBe(401);
    expect((await mw("/admin", cookie)).headers.get("x-middleware-next")).toBe("1");
  });

  it("checks the account again inside admin routes: a disabled navigator's valid session is refused", async () => {
    const c = await submitFamily(1);
    expect((await saveCase(req(`/api/admin/cases/${c.id}`, {}, { method: "PATCH" }), ctx({ id: c.id }))).status).toBe(401);
    const { token } = await issueSetupLink("leaver@example.test", "Leaver");
    const leaver = (await completeSetup(token, "the leaver's long password"))!;
    const session = await createSession(leaver);
    expect((await exportCsv(asNav("/api/admin/export", undefined, "GET", session), none)).status).toBe(200);
    await disableNavigator("leaver@example.test");
    expect((await exportCsv(asNav("/api/admin/export", undefined, "GET", session), none)).status).toBe(401);
  });

  it("refuses changes sent from another site", async () => {
    const c = await submitFamily(1);
    const res = await closeCase(req(`/api/admin/cases/${c.id}/close`, { closed: true, version: 1 }, { headers: { cookie: `${SESSION_COOKIE}=${cookie}`, origin: "https://evil.example" } }), ctx({ id: c.id }));
    expect(res.status).toBe(403);
  });

  it("signs in with the right password only, and counts only failures", async () => {
    expect((await login(req("/api/auth/login", { email: "dee@example.test", password: "wrong" }), none)).status).toBe(401);
    const ok = await login(req("/api/auth/login", { email: "dee@example.test", password: "a long enough password" }), none);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(ok.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    // Guessing from one connection is stopped there, and the navigator can still sign in from their own.
    const attacker = { headers: { "x-forwarded-for": "10.66.66.66" } };
    const codes = [];
    for (let i = 0; i < 9; i++) codes.push((await login(req("/api/auth/login", { email: "dee@example.test", password: `guess-${i}` }, attacker), none)).status);
    expect(codes.at(-1)).toBe(429);
    expect((await login(req("/api/auth/login", { email: "dee@example.test", password: "a long enough password" }, { headers: { "x-forwarded-for": "10.1.2.3" } }), none)).status).toBe(200);
  });

  it("sets up a password once from the link", async () => {
    const { token } = await issueSetupLink("new@example.test", "New");
    expect((await setup(req("/api/auth/setup", { token, password: "short" }), none)).status).toBe(422);
    expect((await setup(req("/api/auth/setup", { token, password: "a good long password" }), none)).status).toBe(200);
    expect((await setup(req("/api/auth/setup", { token, password: "a good long password" }), none)).status).toBe(404);
  });

  it("never logs personal fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const out = log("test", { reference: "AN-1", name: "Joan Whitaker", email: "joan@example.test", answers: { q1: "x" } });
    expect(out).toEqual({ event: "test", at: expect.any(String), reference: "AN-1" });
    expect(spy.mock.calls[0][0]).not.toMatch(/Joan|example/);
    spy.mockRestore();
  });
});

describe("review and release", () => {
  it("saves edits, refuses stale ones, keeps sources out of reach, releases, and the family link shows the released plan", async () => {
    const c = await submitFamily(0);
    const full = (await getCase(c.id))!;
    const plan = {
      ...full.workingPlan,
      actions: full.workingPlan.actions.map((a, i) => (i === 0 ? { ...a, title: "Checked by Dee" } : i === 1 ? { ...a, removed: true } : a)),
      sources: full.workingPlan.sources.map((s) => ({ ...s, url: "https://evil.example/" })),
    };

    const saved = await saveCase(asNav(`/api/admin/cases/${c.id}`, { version: full.version, plan, note: "Rang Anna" }, "PATCH"), ctx({ id: c.id }));
    expect(saved.status).toBe(200);
    const { version } = await saved.json();
    expect((await getCase(c.id))!.workingPlan.sources).toEqual(full.workingPlan.sources);
    expect((await saveCase(asNav(`/api/admin/cases/${c.id}`, { version: full.version, plan, note: "" }, "PATCH"), ctx({ id: c.id }))).status).toBe(409);
    const badPlan = await saveCase(asNav(`/api/admin/cases/${c.id}`, { version, plan: { ...plan, actions: [{ ...plan.actions[0], title: "" }] }, note: "" }, "PATCH"), ctx({ id: c.id }));
    expect(badPlan.status).toBe(422);
    expect((await badPlan.json()).details[0].message).toMatch(/What to do/);

    sent.length = 0;
    const rel = await releaseCase(asNav(`/api/admin/cases/${c.id}/release`, { version }), ctx({ id: c.id }));
    expect(rel.status).toBe(200);
    const { link, emailSent } = await rel.json();
    expect(emailSent).toBe(true);
    expect(sent[0].to).toEqual([FAMILIES[0].contact.email]);
    expect(sent[0].text).toContain(link);
    expect(sent[0].text).not.toMatch(/falls|Peggy/i);

    const token = link.split("/p/")[1];
    const linked = (await caseForToken(token))!;
    expect(linked.releasedPlan.actions[0].title).toBe("Checked by Dee");
    expect(linked.releasedPlan.actions[1].removed).toBe(true);
    expect(await caseForToken("x".repeat(43))).toBeNull();
    expect(await caseForToken("../../etc")).toBeNull();

    const again = await newLink(asNav(`/api/admin/cases/${c.id}/link`, { send: false }), ctx({ id: c.id }));
    const fresh = (await again.json()).link.split("/p/")[1];
    expect(await caseForToken(token)).toBeNull();
    expect(await caseForToken(fresh)).toBeTruthy();

    sent.length = 0;
    const help = await requestHelp(req(`/api/p/${fresh}/request`, { services: ["home_support_setup", "made-up"], contactMethod: "email", phone: "not checked for email" }), ctx({ token: fresh }));
    expect(help.status).toBe(201);
    expect(sent[0].subject).toBe(`Implementation request ${c.reference}`);
    expect((await requestHelp(req(`/api/p/${fresh}/request`, { services: [], contactMethod: "phone", phone: "12" }), ctx({ token: fresh }))).status).toBe(422);
    expect((await feedback(req(`/api/p/${fresh}/feedback`, { useful: "very", madeSense: "partly", missing: "Costs", wantsHelp: true }), ctx({ token: fresh }))).status).toBe(200);
    expect((await requestHelp(req(`/api/p/${token}/request`, { services: [], contactMethod: "email" }), ctx({ token }))).status).toBe(404);
    const after = (await getCase(c.id))!;
    expect(after.feedback?.madeSense).toBe("partly");
    expect(after.navigatorNote).toBe("Rang Anna");

    const [r] = await (await db()).query<{ id: string; phone: string | null }>("select id, phone from implementation_requests where case_id = $1", [c.id]);
    expect(r.phone).toBeNull();
    expect((await requestStatus(asNav(`/api/admin/requests/${r.id}`, { status: "contacted" }, "PATCH"), ctx({ id: r.id }))).status).toBe(200);
  });

  it("closes and reopens with the version, and regenerates from the answers", async () => {
    const c = await submitFamily(3);
    const full = (await getCase(c.id))!;
    const closed = await closeCase(asNav(`/api/admin/cases/${c.id}/close`, { closed: true, version: full.version }), ctx({ id: c.id }));
    const { version } = await closed.json();
    expect((await closeCase(asNav(`/api/admin/cases/${c.id}/close`, { closed: false, version: full.version }), ctx({ id: c.id }))).status).toBe(409);
    const reopened = await (await closeCase(asNav(`/api/admin/cases/${c.id}/close`, { closed: false, version }), ctx({ id: c.id }))).json();
    const res = await regenerate(asNav(`/api/admin/cases/${c.id}/regenerate`, { version: reopened.version }), ctx({ id: c.id }));
    expect(res.status).toBe(200);
  });

  it("deletes a case only when the reference is typed", async () => {
    const c = await submitFamily(4);
    expect((await deleteCase(asNav(`/api/admin/cases/${c.id}`, { confirm: "AN-WRONG1" }, "DELETE"), ctx({ id: c.id }))).status).toBe(422);
    expect((await deleteCase(asNav(`/api/admin/cases/${c.id}`, { confirm: c.reference.toLowerCase() }, "DELETE"), ctx({ id: c.id }))).status).toBe(200);
    expect(await getCase(c.id)).toBeNull();
  });
});

describe("retention job and export", () => {
  it("runs only with the right secret", async () => {
    delete process.env.CRON_SECRET;
    expect((await retention(req("/api/cron/retention"), none)).status).toBe(503);
    process.env.CRON_SECRET = "cron-test-secret";
    expect((await retention(req("/api/cron/retention", undefined, { headers: { authorization: "Bearer wrong" } }), none)).status).toBe(401);
    const res = await retention(req("/api/cron/retention", undefined, { headers: { authorization: "Bearer cron-test-secret" } }), none);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(0);
  });

  it("exports a CSV without contact details or free text", async () => {
    const res = await exportCsv(asNav("/api/admin/export"), none);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    const [head] = text.replace(/^﻿/, "").split("\r\n");
    expect(head).toMatch(/^reference,status,submitted_at/);
    expect(head).toContain(",trigger,");
    expect(head).toContain("q21.epoa_property");
    expect(text).toMatch(/,home_support_setup,/);
    expect(text).not.toMatch(/example\.test|0123456789|Fictional|Susan, wife|Costs/);
  });
});
