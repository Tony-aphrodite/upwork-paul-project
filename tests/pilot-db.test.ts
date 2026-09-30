import { beforeAll, describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { openPglite, useDb, db } from "../src/lib/db";
import * as cases from "../src/lib/cases";
import * as navs from "../src/lib/navigators";
import { hit } from "../src/lib/ratelimit";
import { hashToken, newToken } from "../src/lib/secrets";
import { PilotContent } from "../src/lib/pilot/content";
import { generatePilotPlan } from "../src/lib/pilot/engine";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);

export function newCaseInput(i = 0): cases.NewCase {
  const f = FAMILIES[i];
  const plan = generatePilotPlan(content, f.answers, f.person);
  return {
    answers: f.answers, contact: { name: f.person.contactName, email: f.contact.email, phone: f.contact.phone }, person: f.person,
    consentAt: new Date(), marketingConsent: false, referral: "gp-clinic", urgent: !!plan.urgent, pathways: plan.pathways.map((p) => p.id), plan,
    questionnaireVersion: content.questionnaire.version, contentVersion: content.version,
  };
}

beforeAll(() => { useDb(openPglite("memory")); });

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
    expect(await navs.navigatorEmails()).toEqual(["dee@example.test"]);
  });

  it("can be disabled", async () => {
    const { navigator, token } = await navs.issueSetupLink("temp@example.test", "Temp");
    await navs.completeSetup(token, "another long password");
    expect(await navs.activeNavigator(navigator.id)).toBeTruthy();
    await navs.disableNavigator("temp@example.test");
    expect(await navs.activeNavigator(navigator.id)).toBeNull();
    expect(await navs.checkLogin("temp@example.test", "another long password")).toBeNull();
  });
});

describe("cases", () => {
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

    const edited = { ...c.workingPlan, actions: c.workingPlan.actions.map((a, i) => (i === 0 ? { ...a, title: "Edited by the navigator" } : a)) };
    const v2 = await cases.saveWorking(id, c.version, edited, "Called the daughter", nav.id);
    await expect(cases.saveWorking(id, c.version, edited, "stale", nav.id)).rejects.toThrow(cases.Conflict);

    const token = newToken();
    const { retainUntil } = await cases.release(id, v2, hashToken(token), nav.id);
    expect(retainUntil.getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000);
    const linked = (await cases.caseByTokenHash(hashToken(token)))!;
    expect(linked.releasedPlan.actions[0].title).toBe("Edited by the navigator");
    expect(linked.generatedPlan.actions[0].title).not.toBe("Edited by the navigator"); // the original is kept

    // Later edits do not change what the family sees until the plan is released again.
    c = (await cases.getCase(id))!;
    await cases.saveWorking(id, c.version, { ...c.workingPlan, intro: "Changed after release" }, "", nav.id);
    expect((await cases.caseByTokenHash(hashToken(token)))!.releasedPlan.intro).not.toBe("Changed after release");

    // A replacement link retires the old one.
    const second = newToken();
    await cases.replaceLink(id, hashToken(second), nav.id);
    expect(await cases.caseByTokenHash(hashToken(token))).toBeNull();
    expect(await cases.caseByTokenHash(hashToken(second))).toBeTruthy();
    expect(await cases.caseByTokenHash(hashToken("made-up"))).toBeNull();
  });

  it("keep implementation requests and feedback", async () => {
    const { id } = await cases.createCase(newCaseInput(1));
    const rid = await cases.addRequest(id, { services: ["home_support_setup"], contactMethod: "phone", phone: "0123456789", bestTime: "Mornings", message: "Please call" });
    expect((await cases.listCases("all")).find((x) => x.id === id)!.openRequests).toBe(1);
    expect(await cases.setRequestStatus(rid, "contacted", "nav")).toBe(true);
    expect((await cases.listRequests(id))[0].status).toBe("contacted");
    await cases.saveFeedback(id, { useful: "very", madeSense: "yes", missing: "", confusing: "", wantsHelp: true });
    expect((await cases.getCase(id))!.feedback!.useful).toBe("very");
  });

  it("are deleted on request or when their retention date passes, leaving only anonymous events", async () => {
    const a = await cases.createCase(newCaseInput(2));
    const b = await cases.createCase(newCaseInput(3));
    await cases.addRequest(a.id, { services: [], contactMethod: "email", phone: null, bestTime: "", message: "" });
    await cases.deleteCase(a.id, "nav");
    expect(await cases.getCase(a.id)).toBeNull();
    expect(await cases.listRequests(a.id)).toEqual([]);

    const d = await db();
    await d.query("update cases set retain_until = now() - interval '1 day' where id = $1", [b.id]);
    expect(await cases.purgeExpired()).toBe(1);
    expect(await cases.getCase(b.id)).toBeNull();
    const events = await d.query<{ case_id: string | null; type: string }>("select case_id, type from events where type like 'deleted%'");
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["deleted", "deleted_expired"]));
    expect(events.every((e) => e.case_id === null)).toBe(true);
  });

  it("put urgent cases first in the open list", async () => {
    await cases.createCase(newCaseInput(2)); // the hospital family is urgent
    const open = await cases.listCases("open");
    expect(open[0].urgent).toBe(true);
    const n = await cases.counts();
    expect(n.all).toBeGreaterThanOrEqual(n.open + n.released + n.closed);
  });

  it("can be closed and reopened", async () => {
    const { id } = await cases.createCase(newCaseInput(4));
    await cases.setClosed(id, true, "nav");
    expect((await cases.getCase(id))!.status).toBe("closed");
    await cases.setClosed(id, false, "nav");
    expect((await cases.getCase(id))!.status).toBe("in_review");
  });

  it("export without contact details", async () => {
    const rows = await cases.exportRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(/example\.test|0123456789|Fictional/);
  });
});

describe("rate limits", () => {
  it("allow up to the limit in a window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hit("test:key", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
