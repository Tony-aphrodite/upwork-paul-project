import { describe, expect, it } from "vitest";
import { z } from "zod";
import cases from "../content/cases.json";
import { ActionPlan, FamilyProfile, ModuleDefinition } from "../src/lib/schema";
import { builtInLibrary, withModules } from "../src/lib/library";
import { fieldsOf, test as cond } from "../src/lib/engine/conditions";
import { generatePlan, matchProviders, relevantModules, saveProgress } from "../src/lib/engine/generate";
import { CASE_IDS, NOW, planOf, profileOf } from "./helpers";

const mods = (id: string) => planOf(id).modules.map((m) => m.id);

describe("schemas and content", () => {
  it("every test case is a valid Family Profile", () => { for (const c of cases) expect(FamilyProfile.safeParse(c.profile).success, c.id).toBe(true); });
  it("rejects a bad profile with paths for each problem", () => {
    const r = FamilyProfile.safeParse({ ...cases[0].profile, profileId: "x", person: { ...cases[0].profile.person, age: 12 } });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["profileId", "person.age"]));
  });
  it("the library has the 18 modules from the brief", () => expect(builtInLibrary.modules).toHaveLength(18));
  it("every field a module condition reads exists in the profile schema", () => {
    const paths = new Set<string>();
    const walk = (s: Record<string, unknown>, prefix: string) => {
      for (const [k, v] of Object.entries((s.properties ?? {}) as Record<string, Record<string, unknown>>)) { paths.add(prefix + k); walk(v, `${prefix}${k}.`); }
    };
    walk(z.toJSONSchema(FamilyProfile, { io: "input" }) as Record<string, unknown>, "");
    const used = builtInLibrary.modules.flatMap((m) => [m.when, ...m.priority.rules.map((r) => r.when), ...m.noticed.map((x) => x.when), ...m.actions.map((x) => x.when), ...m.questions.map((x) => x.when), ...m.information.map((x) => x.when)].flatMap(fieldsOf));
    for (const f of new Set(used)) expect(paths.has(f), f).toBe(true);
  });
  it("every source a module cites exists", () => {
    const ids = new Set(builtInLibrary.sources.map((s) => s.id));
    for (const m of builtInLibrary.modules) for (const i of m.information) if (i.sourceId) expect(ids.has(i.sourceId), `${m.id} → ${i.sourceId}`).toBe(true);
  });
  it("every generated plan is valid against the Action Plan schema, with no unfilled placeholders", () => {
    for (const id of CASE_IDS) {
      const plan = planOf(id);
      expect(ActionPlan.safeParse(plan).success, id).toBe(true);
      expect(JSON.stringify(plan), id).not.toMatch(/\{\{|undefined|NaN/);
    }
  });
});

describe("conditional modules", () => {
  it("evaluates all, any, not and each operator", () => {
    const d = { a: 2, b: "x", c: [], d: ["y"], e: null };
    expect(cond({ all: [{ field: "a", op: "gte", value: 2 }, { field: "b", op: "in", value: ["x"] }] }, d)).toBe(true);
    expect(cond({ any: [{ field: "c", op: "truthy" }, { field: "d", op: "includes", value: "y" }] }, d)).toBe(true);
    expect(cond({ not: { field: "e", op: "exists" } }, d)).toBe(true);
    expect(cond({ field: "missing.deep", op: "eq", value: 1 }, d)).toBe(false);
  });
  it("living alone with falls: safety and falls now, no residential or hospital topics", () => {
    const m = mods("alone-with-falls");
    expect(m).toEqual(expect.arrayContaining(["staying-safe-at-home", "falls-and-mobility", "epoa-and-legal-planning"]));
    expect(m).not.toEqual(expect.arrayContaining(["residential-care"]));
    expect(m).not.toContain("hospital-discharge");
    expect(planOf("alone-with-falls").summary.nextStep).toMatch(/smoke alarms/i);
  });
  it("dementia with an exhausted spouse: dementia, respite, carer and EPOA are all 'now'", () => {
    const p = planOf("dementia-exhausted-spouse");
    const level = (id: string) => p.modules.find((m) => m.id === id)?.priority;
    for (const id of ["dementia-and-cognitive-changes", "respite", "family-carer-support", "epoa-and-legal-planning"]) expect(level(id), id).toBe("now");
  });
  it("hospital discharge: the discharge module is included and urgent", () => {
    expect(planOf("hospital-discharge").modules.find((m) => m.id === "hospital-discharge")?.priority).toBe("now");
  });
  it("healthy couple: planning topics only, nothing urgent", () => {
    const p = planOf("healthy-couple");
    expect(p.modules.map((m) => m.id)).toEqual(expect.arrayContaining(["epoa-and-legal-planning", "retirement-villages", "future-planning"]));
    for (const id of ["falls-and-mobility", "home-care-and-support", "hospital-discharge", "respite", "dementia-and-cognitive-changes", "equipment-and-home-modifications"]) expect(p.modules.map((m) => m.id)).not.toContain(id);
    expect(p.actions.some((a) => a.priority === "now")).toBe(false);
  });
  it("residential care: care topic and subsidy information appear", () => {
    const p = planOf("residential-care");
    expect(p.modules.map((m) => m.id)).toContain("residential-care");
    expect(JSON.stringify(p.modules)).toMatch(/Residential Care Subsidy/);
  });
  it("funding worries: funding is the first priority", () => expect(planOf("funding-worries").priorities[0].moduleId).toBe("government-funding"));
  it("every plan has 3 to 5 top priorities, in urgency order", () => {
    for (const id of CASE_IDS) {
      const pr = planOf(id).priorities;
      expect(pr.length, id).toBeGreaterThanOrEqual(3);
      expect(pr.length, id).toBeLessThanOrEqual(5);
      const order = pr.map((x) => ["now", "soon", "plan_ahead"].indexOf(x.level));
      expect(order, id).toEqual([...order].sort());
    }
  });
  it("the long-content case switches on 16 of 18 modules; the two that conflict with an urgent move into care stay off", () => {
    const ids = relevantModules(profileOf("long-content-stress"), builtInLibrary.modules).map((m) => m.def.id);
    expect(ids).toHaveLength(16);
    expect(ids).not.toContain("retirement-villages");
    expect(ids).not.toContain("future-planning");
  });
  it("a new module added as data appears without code changes", () => {
    const extra = { id: "hearing-and-vision", title: "Hearing and vision", order: 125, headline: "Check hearing", when: { field: "person.age", op: "gte", value: 80 }, priority: { default: "plan_ahead", rules: [] }, noticed: [{ text: "{{name}} is {{age}}." }], actions: [{ id: "eye-test", title: "Book an eye test", description: "", timing: "Within 3 months", responsible: "{{preparedFor}}" }] };
    const lib = withModules(builtInLibrary, [extra]);
    const plan = generatePlan(profileOf("alone-with-falls"), lib, { now: NOW });
    expect(plan.modules.map((m) => m.id)).toContain("hearing-and-vision");
    expect(plan.generatedBy.moduleSet).toMatch(/^custom-/);
    expect(() => withModules(builtInLibrary, [{ ...extra, when: { field: "x", op: "resembles" } }])).toThrow();
  });
});

describe("versions and the living plan", () => {
  const profile = profileOf("alone-with-falls");
  const v1 = planOf("alone-with-falls");
  it("the first plan is version 1.0 with a history entry", () => {
    expect(v1.version).toBe("1.0");
    expect(v1.history).toHaveLength(1);
  });
  it("regenerating keeps status, notes and changed owners, and retires actions that no longer apply", () => {
    const worked = { ...v1, actions: v1.actions.map((a) => a.key === "staying-safe-at-home:smoke-alarms" ? { ...a, status: "completed" as const, notes: "Fitted by Anna" } : a.key === "falls-and-mobility:gp-falls-review" ? { ...a, status: "in_progress" as const, responsible: "Anna and Dr Lee" } : a) };
    const withNav = { ...worked, actions: [...worked.actions, { ...worked.actions[0], key: "navigator:custom-1", title: "Ring the council about the footpath", source: "navigator" as const, moduleId: "navigator" }] };
    const changed = { ...profile, homeSafety: { ...profile.homeSafety, smokeAlarms: true }, mobility: { ...profile.mobility, fallsLast12Months: 3 } };
    const v2 = generatePlan(changed, builtInLibrary, { previous: withNav, now: new Date("2026-10-01T09:00:00Z"), reason: "Review" });
    const get = (k: string) => v2.actions.find((a) => a.key === k)!;
    expect(v2.version).toBe("1.1");
    expect(v2.planId).toBe(v1.planId);
    expect(get("falls-and-mobility:gp-falls-review")).toMatchObject({ status: "in_progress", responsible: "Anna and Dr Lee" });
    expect(get("staying-safe-at-home:smoke-alarms")).toMatchObject({ status: "completed", notes: "Fitted by Anna" });
    expect(get("navigator:custom-1")).toBeTruthy();
    expect(v2.history.at(-1)!.reason).toBe("Review");
    expect(v2.history.at(-1)!.changes!.removed).toEqual([]);
  });
  it("actions that are no longer indicated stay on record as 'No longer required'", () => {
    const changed = { ...profile, homeSafety: { ...profile.homeSafety, smokeAlarms: true } };
    const v2 = generatePlan(changed, builtInLibrary, { previous: v1, now: new Date("2026-10-01T09:00:00Z") });
    expect(v2.actions.find((a) => a.key === "staying-safe-at-home:smoke-alarms")).toMatchObject({ status: "no_longer_required" });
    expect(v2.history.at(-1)!.changes!.removed).toContain("staying-safe-at-home:smoke-alarms");
  });
  it("saving progress creates a new version and records what changed", () => {
    const edited = { ...v1, actions: v1.actions.map((a, i) => (i === 0 ? { ...a, status: "waiting_third_party" as const } : a)) };
    const v = saveProgress(edited, v1, "Waiting for the GP", new Date("2026-09-25T09:00:00Z"));
    expect(v.version).toBe("1.1");
    expect(v.history.at(-1)!.changes!.changed[0]).toMatchObject({ key: v1.actions[0].key, fields: ["status"] });
  });
  it("the profile fingerprint changes when the profile does", () => {
    const v2 = generatePlan({ ...profile, notes: "changed" }, builtInLibrary, { previous: v1, now: NOW });
    expect(v2.profileHash).not.toBe(v1.profileHash);
  });
});

describe("transparent provider matching", () => {
  it("lists matched and unmatched criteria and never shows another region", () => {
    const p = profileOf("dementia-exhausted-spouse");
    const m = matchProviders(p, builtInLibrary.providers, "respite", ["residential_care", "home_care"]);
    expect(m.length).toBeGreaterThan(0);
    for (const x of m) expect(x.matched).toContain("Location: Bay of Plenty");
    const waitlisted = m.find((x) => x.name === "Bayside Care at Home")!;
    expect(waitlisted.notMatched).toContain("Availability: waiting list");
  });
  it("a provider without dementia support says so", () => {
    const p = profileOf("residential-care");
    const m = matchProviders({ ...p, cognition: { ...p.cognition, diagnosis: "dementia" } }, builtInLibrary.providers, "residential-care", ["residential_care"]);
    expect(m.find((x) => x.name === "Glenlea Care Lodge")!.notMatched).toContain("Dementia support");
  });
});
