import { beforeAll, describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { db } from "../src/lib/db";
import * as cases from "../src/lib/cases";
import * as navs from "../src/lib/navigators";
import { blocked, hit } from "../src/lib/ratelimit";
import { hashToken, newToken } from "../src/lib/secrets";
import { PilotContent } from "../src/lib/pilot/content";
import { generatePilotPlan } from "../src/lib/pilot/engine";
import { freshTestDb } from "./db-setup";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const nowSeconds = () => Math.floor(Date.now() / 1000);

export function newCaseInput(i = 0, submissionId?: string): cases.NewCase {
  const f = FAMILIES[i];
  const plan = generatePilotPlan(content, f.answers, f.person);
  return {
    submissionId, answers: f.answers, contact: { name: f.person.contactName, email: f.contact.email, phone: f.contact.phone }, person: f.person,
    consentAt: new Date(), marketingConsent: false, referral: "gp-clinic", urgent: !!plan.urgent, pathways: plan.pathways.map((p) => p.id), plan,
    questionnaireVersion: content.questionnaire.version, contentVersion: content.version,
  };
}

let navId = "";
beforeAll(async () => {
  await freshTestDb();
  navId = (await navs.issueSetupLink("worker@example.test", "Worker")).navigator.id;
});

describe("storage", () => {
  it("keeps JSON as JSON, not as a string of JSON", async () => {
    const { id } = await cases.createCase(newCaseInput(0));
    const [r] = await (await db()).query<Record<string, string>>(
      "select jsonb_typeof(answers) a, jsonb_typeof(pathways) p, jsonb_typeof(working_plan) w, answers->>'q6' q6 from cases where id = $1", [id]);
    expect(r).toEqual({ a: "object", p: "array", w: "object", q6: "alone" });
  });

  it("refuses an undefined parameter instead of guessing", async () => {
    await expect((await db()).query("select $1::text", [undefined as never])).rejects.toThrow(/undefined/);
  });
});

describe("navigator accounts", () => {
  it("are set up through a one-time link and sign in with their own password", async () => {
    const { navigator, token } = await navs.issueSetupLink("Dee@Example.test", "Dee");
    expect(navigator.email).toBe("dee@example.test");
    expect(await navs.setupTokenValid(token)).toEqual({ name: "Dee", email: "dee@example.test" });
    expect(await navs.completeSetup(token, "too-short")).toBeNull();
    expect(await navs.checkLogin("dee@example.test", "a long enough password")).toBeNull();
    expect(await navs.completeSetup(token, "a long enough password")).toMatchObject({ email: "dee@example.test" });
    expect(await navs.completeSetup(token, "a long enough password")).toBeNull(); // the link works once
    expect(await navs.checkLogin("DEE@example.test ", "a long enough password")).toMatchObject({ name: "Dee" });
    expect(await navs.checkLogin("dee@example.test", "wrong password here")).toBeNull();
    expect(await navs.checkLogin("nobody@example.test", "a long enough password")).toBeNull();
    expect(await navs.navigatorEmails()).toEqual(["dee@example.test"]); // the worker has not set a password
  });

  it("end every session and the old password when a new setup link is issued, until it is used", async () => {
    const { navigator, token } = await navs.issueSetupLink("reset@example.test", "Reset");
    await navs.completeSetup(token, "the first long password");
    const issuedBefore = nowSeconds() - 5;
    expect(await navs.activeNavigator(navigator.id, nowSeconds())).toBeTruthy();
    await new Promise((r) => setTimeout(r, 1100));
    const again = await navs.issueSetupLink("reset@example.test", "Reset");
    expect(await navs.checkLogin("reset@example.test", "the first long password")).toBeNull();
    expect(await navs.activeNavigator(navigator.id, issuedBefore)).toBeNull();
    await navs.completeSetup(again.token, "the second long password");
    expect(await navs.checkLogin("reset@example.test", "the second long password")).toBeTruthy();
    expect(await navs.activeNavigator(navigator.id, nowSeconds())).toBeTruthy();
  });

  it("can be disabled, which ends their sessions at once", async () => {
    const { navigator, token } = await navs.issueSetupLink("temp@example.test", "Temp");
    await navs.completeSetup(token, "another long password");
    expect(await navs.activeNavigator(navigator.id, nowSeconds())).toBeTruthy();
    await navs.disableNavigator("temp@example.test");
    expect(await navs.activeNavigator(navigator.id, nowSeconds() + 60)).toBeNull();
    expect(await navs.checkLogin("temp@example.test", "another long password")).toBeNull();
  });
});

describe("cases", () => {
  it("find the case already made when the same submission arrives twice", async () => {
    const first = await cases.createCase(newCaseInput(1, "submission-0000000000000001"));
    const second = await cases.createCase(newCaseInput(1, "submission-0000000000000001"));
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, reference: first.reference, created: false });
    const events = await (await db()).query("select type from events where case_id = $1", [first.id]);
    expect(events).toHaveLength(1);
  });

  it("move from new to released, and only the released snapshot reaches the family", async () => {
    const { id, reference } = await cases.createCase(newCaseInput(0));
    expect(reference).toMatch(/^AN-[A-Z2-9]{6}$/);
    const nav = (await navs.issueSetupLink("nav1@example.test", "Nav One")).navigator;

    let c = (await cases.getCase(id))!;
    expect(c.status).toBe("submitted");
    expect(c.referral).toBe("gp-clinic");
    expect((await cases.listCases("open")).map((x) => x.id)).toContain(id);

    await cases.markOpened(id, nav.id);
    c = (await cases.getCase(id))!;
    expect(c.status).toBe("in_review");
    expect(c.reviewedAt).toBeTruthy();

    const edited = { ...c.workingPlan, actions: c.workingPlan.actions.map((a, i) => (i === 0 ? { ...a, title: "Edited by the navigator" } : a)) };
    const v2 = await cases.saveWorking(id, c.version, edited, "Called the daughter", nav.id);
    await expect(cases.saveWorking(id, c.version, edited, "stale", nav.id)).rejects.toThrow(cases.Conflict);

    const token = newToken();
    const { retainUntil } = await cases.release(id, v2, hashToken(token), nav.id);
    expect(retainUntil.getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000);
    const linked = (await cases.caseByTokenHash(hashToken(token)))!;
    expect(linked.releasedPlan.actions[0].title).toBe("Edited by the navigator");
    expect(linked.generatedPlan.actions[0].title).not.toBe("Edited by the navigator");

    c = (await cases.getCase(id))!;
    await cases.saveWorking(id, c.version, { ...c.workingPlan, intro: "Changed after release" }, "", nav.id);
    expect((await cases.caseByTokenHash(hashToken(token)))!.releasedPlan.intro).not.toBe("Changed after release");

    const second = newToken();
    await cases.replaceLink(id, hashToken(second), nav.id);
    expect(await cases.caseByTokenHash(hashToken(token))).toBeNull();
    expect(await cases.caseByTokenHash(hashToken(second))).toBeTruthy();
    expect(await cases.caseByTokenHash(hashToken("made-up"))).toBeNull();
  });

  it("keep a case in review from being deleted while it is worked on", async () => {
    const { id } = await cases.createCase(newCaseInput(3));
    const d = await db();
    await d.query("update cases set retain_until = now() + interval '1 day' where id = $1", [id]);
    const c = (await cases.getCase(id))!;
    await cases.saveWorking(id, c.version, c.workingPlan, "", navId);
    expect((await cases.getCase(id))!.retainUntil.getTime()).toBeGreaterThan(Date.now() + 50 * 86_400_000);
  });

  it("cannot be edited, regenerated or released once closed, and close/reopen check the version", async () => {
    const { id } = await cases.createCase(newCaseInput(4));
    let c = (await cases.getCase(id))!;
    const closedV = await cases.setClosed(id, c.version, true, navId);
    await expect(cases.setClosed(id, c.version, false, navId)).rejects.toThrow(cases.Conflict);
    await expect(cases.saveWorking(id, closedV, c.workingPlan, "", navId)).rejects.toThrow(cases.Conflict);
    await expect(cases.release(id, closedV, hashToken(newToken()), navId)).rejects.toThrow(cases.Conflict);
    const openV = await cases.setClosed(id, closedV, false, navId);
    c = (await cases.getCase(id))!;
    expect(c.status).toBe("in_review");
    expect(c.version).toBe(openV);
  });

  it("keep implementation requests and feedback", async () => {
    const { id } = await cases.createCase(newCaseInput(1));
    const rid = await cases.addRequest(id, { services: ["home_support_setup"], contactMethod: "phone", phone: "0123456789", bestTime: "Mornings", message: "Please call" });
    expect((await cases.listCases("all")).find((x) => x.id === id)!.openRequests).toBe(1);
    expect(await cases.setRequestStatus(rid, "contacted", "nav")).toBe(true);
    expect((await cases.listRequests(id))[0]).toMatchObject({ status: "contacted", services: ["home_support_setup"] });
    await cases.saveFeedback(id, { useful: "very", madeSense: "yes", missing: "", confusing: "", wantsHelp: true });
    expect((await cases.getCase(id))!.feedback!.useful).toBe("very");
  });

  it("are deleted on request or when their retention date passes, leaving only anonymous events", async () => {
    const a = await cases.createCase(newCaseInput(2));
    const b = await cases.createCase(newCaseInput(3));
    await cases.addRequest(a.id, { services: [], contactMethod: "email", phone: null, bestTime: "", message: "" });
    expect(await cases.deleteCase(a.id, "nav")).toBe(true);
    expect(await cases.deleteCase(a.id, "nav")).toBe(false); // already gone: nothing recorded twice
    expect(await cases.getCase(a.id)).toBeNull();
    expect(await cases.listRequests(a.id)).toEqual([]);

    const d = await db();
    await d.query("update cases set retain_until = now() - interval '1 day' where id = $1", [b.id]);
    expect(await cases.purgeExpired()).toBe(1);
    expect(await cases.purgeExpired()).toBe(0);
    expect(await cases.getCase(b.id)).toBeNull();
    const events = await d.query<{ case_id: string | null; type: string }>("select case_id, type from events where type like 'deleted%'");
    expect(events.filter((e) => e.type === "deleted")).toHaveLength(1);
    expect(events.filter((e) => e.type === "deleted_expired")).toHaveLength(1);
    expect(events.every((e) => e.case_id === null)).toBe(true);
  });

  it("put urgent cases first in the open list", async () => {
    await cases.createCase(newCaseInput(2)); // the hospital family is urgent
    const open = await cases.listCases("open");
    expect(open[0].urgent).toBe(true);
    const n = await cases.counts();
    expect(n.all).toBe(n.open + n.released + n.closed);
  });

  it("export without contact details, with requested services as plain values", async () => {
    const rows = await cases.exportRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/example\.test|0123456789|Fictional/);
    const withRequest = rows.find((r) => Number(r.requests) > 0)!;
    expect(withRequest.requested_services).toEqual(["home_support_setup"]);
  });
});

describe("rate limits", () => {
  it("allow up to the limit in a window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hit("test:key", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });

  it("can be checked without counting", async () => {
    expect(await blocked("test:other", 2, 60)).toBe(false);
    await hit("test:other", 99, 60); await hit("test:other", 99, 60);
    expect(await blocked("test:other", 2, 60)).toBe(true);
  });
});
