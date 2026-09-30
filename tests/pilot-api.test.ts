import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { openPglite, useDb } from "../src/lib/db";
import { setTransport, type Email } from "../src/lib/email";
import { SESSION_COOKIE, createSession } from "../src/lib/auth";
import { completeSetup, issueSetupLink } from "../src/lib/navigators";
import { getCase, listCases } from "../src/lib/cases";
import { caseForToken } from "../src/lib/family-link";
import { middleware } from "../src/middleware";
import { log } from "../src/lib/log";
import { POST as submit } from "../src/app/api/submit/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { PATCH as saveCase, DELETE as deleteCase } from "../src/app/api/admin/cases/[id]/route";
import { POST as releaseCase } from "../src/app/api/admin/cases/[id]/release/route";
import { POST as newLink } from "../src/app/api/admin/cases/[id]/link/route";
import { POST as regenerate } from "../src/app/api/admin/cases/[id]/regenerate/route";
import { POST as requestHelp } from "../src/app/api/p/[token]/request/route";
import { POST as feedback } from "../src/app/api/p/[token]/feedback/route";
import { GET as retention } from "../src/app/api/cron/retention/route";
import { GET as exportCsv } from "../src/app/api/admin/export/route";
import { FAMILIES } from "./pilot-families";

const sent: Email[] = [];
let cookie = "";
let ipSeq = 0;

const req = (url: string, body?: unknown, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new Request(`http://x${url}`, {
    method: init.method ?? (body === undefined ? "GET" : "POST"),
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq % 250}`, ...init.headers },
  });
const asNav = (url: string, body?: unknown, method?: string) => req(url, body, { method, headers: { cookie: `${SESSION_COOKIE}=${cookie}` } });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

const submission = (i: number, extra: Record<string, unknown> = {}) => {
  const f = FAMILIES[i];
  return { answers: f.answers, contact: { name: f.person.contactName, email: f.contact.email, phone: f.contact.phone }, person: { firstName: f.person.firstName, preferredName: f.person.preferredName }, consent: true, referral: "GP-Clinic!", ...extra };
};

async function submitFamily(i: number) {
  const res = await submit(req("/api/submit", submission(i)));
  expect(res.status).toBe(201);
  const { reference } = await res.json();
  return (await listCases("all")).find((c) => c.reference === reference)!;
}

beforeAll(async () => {
  useDb(openPglite("memory"));
  setTransport(async (e) => { sent.push(e); return { ok: true }; });
  const { token } = await issueSetupLink("dee@example.test", "Dee");
  const nav = (await completeSetup(token, "a long enough password"))!;
  cookie = await createSession(nav);
});

describe("submitting the questionnaire", () => {
  it("stores the case, tells the navigators, and returns no plan", async () => {
    sent.length = 0;
    const res = await submit(req("/api/submit", submission(0)));
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
    const res = await submit(req("/api/submit", submission(2)));
    const body = await res.json();
    expect(body.urgent).toBe(true);
    expect(body.urgentGuidance).toMatch(/111/);
    expect(sent[0].subject).toMatch(/^URGENT/);
  });

  it("refuses missing answers with the question IDs, and a missing consent", async () => {
    const { q6, ...rest } = FAMILIES[0].answers;
    void q6;
    const res = await submit(req("/api/submit", submission(0, { answers: rest })));
    expect(res.status).toBe(422);
    expect((await res.json()).details.map((d: { path: string }) => d.path)).toContain("q6");
    expect((await submit(req("/api/submit", submission(0, { consent: false })))).status).toBe(422);
    expect((await submit(req("/api/submit", submission(0, { contact: { name: "A", email: "not-an-email" } })))).status).toBe(422);
  });

  it("drops options that do not exist and quietly ignores bots", async () => {
    const before = (await listCases("all")).length;
    const bot = await submit(req("/api/submit", submission(0, { website: "http://spam.example" })));
    expect(bot.status).toBe(200);
    expect((await listCases("all")).length).toBe(before);
    const c = await submitFamily(0);
    const res = await submit(req("/api/submit", submission(0, { answers: { ...FAMILIES[0].answers, q8: ["falls", "<script>"], q99: "x" } })));
    expect(res.status).toBe(201);
    void c;
  });

  it("limits submissions from one connection", async () => {
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await submit(req("/api/submit", submission(1), { headers: { "x-forwarded-for": "10.9.9.9" } }))).status);
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

  it("checks the session again inside admin routes", async () => {
    const c = await submitFamily(1);
    expect((await saveCase(req(`/api/admin/cases/${c.id}`, {}, { method: "PATCH" }), ctx({ id: c.id }))).status).toBe(401);
    expect((await exportCsv(req("/api/admin/export"))).status).toBe(401);
  });

  it("signs in with the right password only, and limits guessing per account", async () => {
    expect((await login(req("/api/auth/login", { email: "dee@example.test", password: "wrong" }))).status).toBe(401);
    const ok = await login(req("/api/auth/login", { email: "dee@example.test", password: "a long enough password" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(ok.headers.get("set-cookie")).toMatch(/SameSite=strict/i);
    const codes = [];
    for (let i = 0; i < 9; i++) codes.push((await login(req("/api/auth/login", { email: "dee@example.test", password: `guess-${i}` }))).status);
    expect(codes.at(-1)).toBe(429);
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
  it("saves edits, refuses stale ones, releases, and the family link shows the released plan", async () => {
    const c = await submitFamily(0);
    const full = (await getCase(c.id))!;
    const plan = { ...full.workingPlan, actions: full.workingPlan.actions.map((a, i) => (i === 0 ? { ...a, title: "Checked by Dee" } : i === 1 ? { ...a, removed: true } : a)) };

    const saved = await saveCase(asNav(`/api/admin/cases/${c.id}`, { version: full.version, plan, note: "Rang Anna" }, "PATCH"), ctx({ id: c.id }));
    expect(saved.status).toBe(200);
    const { version } = await saved.json();
    expect((await saveCase(asNav(`/api/admin/cases/${c.id}`, { version: full.version, plan, note: "" }, "PATCH"), ctx({ id: c.id }))).status).toBe(409);
    expect((await saveCase(asNav(`/api/admin/cases/${c.id}`, { version, plan: { ...plan, actions: "nope" }, note: "" }, "PATCH"), ctx({ id: c.id }))).status).toBe(422);

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

    // A new link retires the old one.
    const again = await newLink(asNav(`/api/admin/cases/${c.id}/link`, { send: false }), ctx({ id: c.id }));
    const fresh = (await again.json()).link.split("/p/")[1];
    expect(await caseForToken(token)).toBeNull();
    expect(await caseForToken(fresh)).toBeTruthy();

    // The family asks for help and leaves feedback.
    sent.length = 0;
    expect((await requestHelp(req(`/api/p/${fresh}/request`, { services: ["home_support_setup", "made-up"], contactMethod: "phone", phone: "0123456789" }), ctx({ token: fresh }))).status).toBe(201);
    expect(sent[0].subject).toBe(`Implementation request ${c.reference}`);
    expect((await requestHelp(req(`/api/p/${fresh}/request`, { services: [], contactMethod: "phone", phone: "" }), ctx({ token: fresh }))).status).toBe(422);
    expect((await feedback(req(`/api/p/${fresh}/feedback`, { useful: "very", madeSense: "partly", missing: "Costs", wantsHelp: true }), ctx({ token: fresh }))).status).toBe(200);
    expect((await requestHelp(req(`/api/p/${token}/request`, { services: [], contactMethod: "email" }), ctx({ token }))).status).toBe(404);
    const after = (await getCase(c.id))!;
    expect(after.feedback?.madeSense).toBe("partly");
    expect(after.navigatorNote).toBe("Rang Anna");
  });

  it("regenerates from the answers, discarding edits", async () => {
    const c = await submitFamily(3);
    const full = (await getCase(c.id))!;
    const res = await regenerate(asNav(`/api/admin/cases/${c.id}/regenerate`, { version: full.version }), ctx({ id: c.id }));
    expect(res.status).toBe(200);
    expect((await getCase(c.id))!.version).toBe(full.version + 1);
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
    expect((await retention(req("/api/cron/retention"))).status).toBe(503);
    process.env.CRON_SECRET = "cron-test-secret";
    expect((await retention(req("/api/cron/retention", undefined, { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const res = await retention(req("/api/cron/retention", undefined, { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(0);
  });

  it("exports a CSV without contact details or free text", async () => {
    const res = await exportCsv(asNav("/api/admin/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    const [head] = text.replace(/^﻿/, "").split("\r\n");
    expect(head).toMatch(/^reference,status,submitted_at/);
    expect(head).toContain(",trigger,");
    expect(head).toContain("q21.epoa_property");
    expect(text).not.toMatch(/example\.test|0123456789|Fictional|Susan, wife|Costs/);
  });
});
