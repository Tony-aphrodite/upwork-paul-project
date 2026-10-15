import { describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import careHomesJson from "../content/pilot/care-homes.json";
import { PilotContent } from "../src/lib/pilot/content";
import { CareHomes, matchCareHomes, type CareHomes as Data } from "../src/lib/pilot/care-homes";
import { generatePilotPlan } from "../src/lib/pilot/engine";
import { renderPlanDocument, renderPlanSections } from "../src/lib/pilot/render";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const real = CareHomes.parse(careHomesJson);
const home = (id: string, area: string, levels: Data["homes"][number]["levels"]) =>
  ({ id, name: `Home ${id}`, operator: "", area, locality: "", address: `${id} Fictional Road`, levels, respite: false, villageOnSite: false, contact: "" });
const fictional: Data = {
  source: "a fictional list", checkedOn: "2026-10-12",
  homes: [
    home("a", "tauranga", ["rest_home", "hospital"]), home("b", "tauranga", ["rest_home"]), home("c", "tauranga", ["hospital", "dementia"]),
    home("d", "western_bay_of_plenty", ["dementia"]), home("e", "whakatane", ["dementia"]), home("f", "tauranga", ["rest_home"]),
    home("g", "tauranga", ["rest_home"]), home("h", "tauranga", ["rest_home"]),
  ],
};
const residential = FAMILIES.find((f) => f.id === "residential-assessed")!;

describe("care homes that may suit", () => {
  it("offer the level the family reports, where they live first, then next door, never further", () => {
    const { homes } = matchCareHomes(fictional, { q5_town: "tauranga", q19_level: "dementia" }, "seed");
    expect(homes.map((h) => h.id)).toEqual(["c", "d"]); // Tauranga first, then the Western Bay of Plenty; not Whakatāne
    expect(homes[0].why).toEqual(["Offers dementia care, the level you told us about", "In Tauranga, where they live"]);
    expect(homes[1].why[1]).toBe("Near Tauranga, in the Western Bay of Plenty");
  });

  it("show at most three, chosen fairly: the same family always gets the same homes, families differ", () => {
    const pick = (seed: string) => matchCareHomes(fictional, { q5_town: "tauranga", q19_level: "rest_home" }, seed).homes.map((h) => h.id);
    expect(pick("family one")).toHaveLength(3);
    expect(pick("family one")).toEqual(pick("family one"));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => pick(`family ${i}`).join()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("list homes with the levels they offer when no level is known, and none without a known area or a match", () => {
    const { homes, level } = matchCareHomes(fictional, { q5_town: "whakatane", q19_level: "unsure" }, "s");
    expect(level).toBeUndefined();
    expect(homes.map((h) => h.id)).toEqual(["e"]);
    expect(homes[0].why).toEqual(["In Whakatāne, where they live"]);
    expect(matchCareHomes(fictional, { q5_town: "somewhere_else", q19_level: "rest_home" }, "s").homes).toEqual([]);
    expect(matchCareHomes(fictional, { q19_level: "rest_home" }, "s").homes).toEqual([]);
    expect(matchCareHomes(fictional, { q5_town: "tauranga", q19_level: "psychogeriatric" }, "s").homes).toEqual([]);
  });

  it("appear in a plan only on the residential pathway, with the intro and the source", () => {
    const plan = generatePilotPlan(content, residential.answers, residential.person, { careHomes: real });
    expect(plan.careHomes).toHaveLength(3);
    for (const h of plan.careHomes) {
      expect(h.levels).toContain("Rest home care");
      expect(h.why[1]).toBe("In Tauranga, where they live");
    }
    expect(plan.careHomesIntro).toMatch(/not a recommendation/);
    expect(plan.careHomesSource).toMatch(/Ministry of Health.*12 October 2026/);
    const stayHome = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, { careHomes: real });
    expect(stayHome.careHomes).toEqual([]);
    expect(stayHome.careHomesIntro).toBe("");
  });

  it("show what each home offers and why, never prices or vacancies, and drop removed homes", () => {
    const plan = generatePilotPlan(content, residential.answers, residential.person, { careHomes: real });
    const html = renderPlanSections(plan, { mode: "web" });
    expect(html).toContain("Care homes that may suit");
    expect(html).toContain("Why it appears: Offers rest home care");
    const section = html.slice(html.indexOf('<section class="carehomes">'), html.indexOf("</section>", html.indexOf('<section class="carehomes">')));
    expect(section).not.toMatch(/\$|vacanc|premium/i); // the plan's own actions may mention premium charges; the list never does
    const removed = { ...plan, careHomes: plan.careHomes.map((h) => ({ ...h, removed: true })) };
    expect(renderPlanSections(removed, { mode: "web" })).not.toContain("Care homes that may suit");
    const pdf = renderPlanDocument(plan, { fonts: { kind: "url", base: "/fonts" }, issuedOn: new Date("2026-10-15T00:00:00Z"), reference: "AN-TEST01", coverNote: "" });
    expect(pdf).toContain(plan.careHomes[0].name.replace(/&/g, "&amp;"));
  });

  it("hold only certified Bay of Plenty homes with at least one level, from the client's list", () => {
    expect(real.homes.length).toBeGreaterThan(30);
    expect(real.homes.every((h) => h.levels.length > 0)).toBe(true);
    expect(JSON.stringify(real)).not.toMatch(/\$|vacanc|premium/i);
  });
});
