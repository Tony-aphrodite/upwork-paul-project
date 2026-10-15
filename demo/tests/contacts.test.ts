import { describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import contactsJson from "../content/pilot/contacts.json";
import { PilotContent } from "../src/lib/pilot/content";
import { Contacts, coverageAreas, parseLinks, pickContacts, type Contacts as Data } from "../src/lib/pilot/contacts";
import { generatePilotPlan } from "../src/lib/pilot/engine";
import { liveContacts } from "../src/lib/pilot/plan";
import { renderPlanDocument, renderPlanSections } from "../src/lib/pilot/render";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const real = Contacts.parse(contactsJson);
const org = (id: string, actions: string[], areas: string[] = [], everyPlan = false) =>
  ({ id, name: `Org ${id}`, phone: "0123456789", email: "", website: "", areas, actions, everyPlan });
const fictional: Data = {
  source: "a fictional list", checkedOn: "2026-09-16",
  contacts: [org("a", ["falls"]), org("b", ["epoa", "will"]), org("c", [], [], true), org("d", ["falls"], ["tauranga"]), org("e", [])],
};
const family = (id: string) => FAMILIES.find((f) => f.id === id)!;

describe("useful contacts", () => {
  it("read the client's coverage column as areas: national everywhere, Bay of Plenty as Health NZ's district", () => {
    expect(coverageAreas("National")).toEqual({ areas: [], unknown: [] });
    expect(coverageAreas("Most of NZ; relevant to Bay of Plenty").areas).toEqual([]);
    expect(coverageAreas("Bay of Plenty").areas).toEqual(["tauranga", "western_bay_of_plenty", "whakatane", "kawerau", "opotiki"]);
    expect(coverageAreas("Tauranga & Western Bay of Plenty").areas).toEqual(["tauranga", "western_bay_of_plenty"]);
    expect(coverageAreas("Tauranga").areas).toEqual(["tauranga"]);
    expect(coverageAreas("Bay of Plenty, Rotorua").areas).toContain("rotorua");
    expect(coverageAreas("Taupō").unknown).toEqual(["taupo"]);
    expect(parseLinks("every plan")).toEqual({ everyPlan: true, actions: [] });
    expect(parseLinks("epoa, Will;  epoa").actions).toEqual(["epoa", "will"]);
  });

  it("go with the plan's actions, or every plan, and local ones only to families in their area", () => {
    const ids = (keys: string[], town?: string) => pickContacts(fictional, keys, town ? { q5_town: town } : {}).map((c) => c.id);
    expect(ids(["falls", "will"], "tauranga")).toEqual(["a", "b", "c", "d"]);
    expect(ids(["falls"], "whakatane")).toEqual(["a", "c"]); // d serves Tauranga only
    expect(ids(["falls"], "somewhere_else")).toEqual(["a", "c"]); // an area we do not know: national ones only
    expect(ids([])).toEqual(["c"]); // e has no action, so it never shows
    expect(pickContacts(fictional, ["epoa", "falls"], { q5_town: "tauranga" }).find((c) => c.id === "b")!.actions).toEqual(["epoa"]);
  });

  it("come from the client's list: linked to real actions, with no research notes or prices", () => {
    expect(real.contacts.length).toBeGreaterThanOrEqual(13);
    const keys = new Set(content.actions.map((a) => a.key));
    for (const c of real.contacts) for (const k of c.actions) expect(keys.has(k), `${c.name}: ${k}`).toBe(true);
    expect(real.contacts.find((c) => /seniorline/i.test(c.name))!.everyPlan).toBe(true);
    expect(JSON.stringify(real)).not.toMatch(/verification|still need|\$/i);
  });

  it("appear in a plan with the intro and the source: a dementia family in Tauranga gets the dementia organisations", () => {
    const f = family("dementia-carer");
    const plan = generatePilotPlan(content, f.answers, f.person, { contacts: real });
    const names = plan.contacts.map((c) => c.name).join(" | ");
    expect(names).toMatch(/Dementia Tauranga/);
    expect(names).toMatch(/Alzheimers/);
    expect(names).toMatch(/Seniorline/);
    expect(names).not.toMatch(/Residential Subsidy/);
    expect(plan.contactsIntro).toMatch(/check with each organisation/);
    expect(plan.contactsSource).toBe("These details come from Ageing Navigator's list of organisations, checked on 16 September 2026.");
    const elsewhere = generatePilotPlan(content, { ...f.answers, q5_town: "whakatane" }, f.person, { contacts: real });
    expect(elsewhere.contacts.map((c) => c.name).join(" | ")).not.toMatch(/Dementia Tauranga/);
    expect(generatePilotPlan(content, f.answers, f.person).contacts).toEqual([]);
  });

  it("show phone, email and website, the actions they go with, and leave with their actions", () => {
    const f = family("hospital-urgent");
    const plan = generatePilotPlan(content, f.answers, f.person, { contacts: real });
    const html = renderPlanSections(plan, { mode: "web" });
    const at = html.indexOf('<section class="contacts">');
    const section = html.slice(at, html.indexOf("</section>", at));
    expect(section).toContain("Useful contacts");
    expect(section).toContain('<a href="tel:0800725463">0800 725 463</a>'); // Seniorline, tap to call
    expect(section).toMatch(/For actions? [\d, and]+ above\./);
    expect(section).toMatch(/<a href="https:\/\/www\.healthnz\.govt\.nz\/[^"]+">healthnz\.govt\.nz<\/a>/); // a long address by its site name
    expect(at).toBeGreaterThan(html.indexOf("Help coordinating your next steps")); // at the end of the plan, before Sources
    // Removing the discharge action takes Social Work with it; Seniorline stays.
    const without = { ...plan, actions: plan.actions.map((a) => (a.key === "hospital-discharge" ? { ...a, removed: true } : a)) };
    expect(liveContacts(without).map((c) => c.name).join(" | ")).not.toMatch(/Social Work/);
    expect(liveContacts(without).map((c) => c.name).join(" | ")).toMatch(/Seniorline/);
    const removedAll = { ...plan, contacts: plan.contacts.map((c) => ({ ...c, removed: true })) };
    expect(renderPlanSections(removedAll, { mode: "web" })).not.toContain("Useful contacts");
    const pdf = renderPlanDocument(plan, { fonts: { kind: "url", base: "/fonts" }, issuedOn: new Date("2026-10-15T00:00:00Z"), reference: "AN-TEST01", coverNote: "" });
    expect(pdf).toContain("Useful contacts");
    expect(pdf).not.toContain("tel:"); // the PDF prints the numbers as text
  });

  it("keep numbers with words around them readable, linking only real numbers", () => {
    const plan = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, {
      contacts: { ...fictional, contacts: [{ ...org("s", [], [], true), phone: "0800 STROKE (0800 78 76 53); General 0800 459 954" }] },
    });
    const html = renderPlanSections(plan, { mode: "web" });
    expect(html).toContain('0800 STROKE (<a href="tel:0800787653">0800 78 76 53</a>); General <a href="tel:0800459954">0800 459 954</a>');
  });
});
