import { describe, expect, it } from "vitest";
import { questionnaire } from "../src/lib/questionnaire/library";
import { Questionnaire } from "../src/lib/questionnaire/schema";
import { checkAll, checkSection, progress, pruneAnswers, visibleSections } from "../src/lib/questionnaire/logic";
import { answersToProfile } from "../src/lib/questionnaire/map";
import { fieldsOf } from "../src/lib/engine/conditions";
import { builtInLibrary } from "../src/lib/library";
import { generatePlan, matchProviders } from "../src/lib/engine/generate";
import { FamilyProfile } from "../src/lib/schema";
import type { Answers } from "../src/lib/questionnaire/schema";

/** A complete set of answers for a family that triggers most of the conditional sections. */
const BASE: Answers = {
  c_your_name: "Sarah Whitcombe", c_your_email: "sarah@example.com", c_person_first: "Margaret", c_person_last: "Whitcombe", c_person_preferred: "Maggie",
  q1: "family_member", q2: "son_daughter", q3: "some", q4: "80_84", q5_town: "Rangiora", q5_region: "Canterbury", q6: "alone", q6_owns: "yes", q7: "increasingly_concerned",
  q8: ["falls", "memory_or_thinking", "retirement_villages", "government_funded_support"],
  q9: ["a_fall", "memory_or_thinking_has_changed"],
  q10: "Mum falling when she is alone", q11: "weeks", q11a: "Whether to accept a village offer",
  q12: ["preparing_meals", "housework", "taking_or_organising_medication"], q13: "noticeably_more",
  q14: ["help_from_family"], q15: "probably_not", q16: "some", q16_carer: "Sarah, daughter",
  q17: ["falling", "memory_problems", "cooking_safely"], q17_falls: "two_three", q18: "possibly",
  q18a: ["recent_or_repeated_falls", "cooking_or_appliance_safety"], q18a_detail: "She left the stove on twice last month",
  m1: "concerned", m2: ["forgetting_appointments_or_tasks", "medication"],
  q19: "none", q20: "important",
  f1: "widowed", f2: "yes", f3: "300k_500k", f4: "cost_matters",
  q21: { will: "yes", epoa_property: "unsure", epoa_welfare: "no", advance_care_plan: "no" }, q22: "no",
  q23: "village", q24: ["stairs", "home_is_too_large_to_manage", "being_alone"],
  rv1: "current_area", rv2: ["villa"], rv3: "some_help", rv4: "important",
  rv5: ["pets_allowed", "outdoor_space_or_gardens", "smaller_village"], rv6: "600k_800k", rv7: "3_6_months",
  q25: "you", q26: "mostly", q27: "elsewhere_nz", q28: "you",
  q29: ["gp"], q30: "We called the GP and asked about a memory test",
  q31: ["we_don_t_know_what_to_do_first", "cost"], q32: ["knowing_what_we_should_do_first", "making_the_home_safer", "finding_retirement_villages_that_fit_our_needs"], q33: "",
};

describe("the questionnaire file", () => {
  it("is valid content, not code", () => expect(Questionnaire.safeParse(questionnaire).success).toBe(true));
  it("carries a version, which plans record", () => expect(questionnaire.version).toMatch(/^\d{4}-\d{2}-\d+$/));
  it("covers the ten sections of the brief plus five conditional ones", () => {
    expect(questionnaire.sections.filter((s) => s.conditional).map((s) => s.id)).toEqual(["hospital", "memory", "funding", "village", "residential"]);
    expect(questionnaire.sections.flatMap((s) => s.questions).length).toBeGreaterThanOrEqual(60);
  });
  it("every condition reads a question that exists and comes earlier", () => {
    const seen = new Set<string>();
    for (const s of questionnaire.sections) {
      for (const f of fieldsOf(s.when)) expect(seen.has(f), `section ${s.id} reads ${f}`).toBe(true);
      for (const q of s.questions) {
        for (const f of fieldsOf(q.when)) expect(seen.has(f), `${q.id} reads ${f}`).toBe(true);
        seen.add(q.id);
      }
    }
  });
});

describe("only the relevant questions are shown", () => {
  it("hides the five conditional sections for a family with nothing to trigger them", () => {
    const answers: Answers = { ...BASE, q8: ["planning_ahead_for_ageing"], q9: ["nothing_significant_has_changed"], q17: ["none_of_these"], q18: "no", q20: "not_now", q23: "stay_home", q6: "with_partner" };
    expect(visibleSections(questionnaire, answers).map((s) => s.id)).not.toContain("hospital");
    expect(visibleSections(questionnaire, answers).map((s) => s.id)).not.toContain("memory");
    expect(visibleSections(questionnaire, answers).map((s) => s.id)).not.toContain("village");
    expect(visibleSections(questionnaire, answers).map((s) => s.id)).not.toContain("funding");
  });
  it("shows the hospital section when a hospital admission is mentioned", () => {
    const answers: Answers = { ...BASE, q9: ["hospital_admission_or_emergency_department_visit"] };
    expect(visibleSections(questionnaire, answers).map((s) => s.id)).toContain("hospital");
  });
  it("asks what the urgent concern is only when something may be urgent", () => {
    const shown = (q18: string) => visibleSections(questionnaire, { ...BASE, q18 }).flatMap((s) => s.questions.map((q) => q.id));
    expect(shown("yes")).toContain("q18a");
    expect(shown("no")).not.toContain("q18a");
  });
  it("drops answers to questions that are no longer shown", () => {
    const pruned = pruneAnswers(questionnaire, { ...BASE, q18: "no" });
    expect(pruned.q18a).toBeUndefined();
    expect(pruned.q17).toBeDefined();
  });
  it("counts progress over visible required questions only", () => {
    const p = progress(questionnaire, BASE);
    expect(p.percent).toBe(100);
    expect(progress(questionnaire, { q1: "self" }).percent).toBeLessThan(20);
  });
});

describe("validation a family sees", () => {
  it("asks for an answer to every required question in the section", () => {
    const section = visibleSections(questionnaire, {})[1];
    expect(checkSection(section, {}).length).toBeGreaterThan(0);
  });
  it("enforces choose up to three", () => {
    const answers = { ...BASE, q32: ["knowing_what_we_should_do_first", "making_the_home_safer", "understanding_respite", "cost"] };
    expect(checkAll(questionnaire, answers).map((i) => i.message)).toContain("Please choose up to 3.");
  });
  it("checks the email address and the grid rows", () => {
    expect(checkAll(questionnaire, { ...BASE, c_your_email: "sarah@" }).some((i) => i.questionId === "c_your_email")).toBe(true);
    expect(checkAll(questionnaire, { ...BASE, q21: { will: "yes" } }).some((i) => i.questionId === "q21")).toBe(true);
  });
  it("accepts a complete set of answers", () => expect(checkAll(questionnaire, BASE)).toEqual([]));
});

describe("answers become a Family Profile", () => {
  const { profile, inferred, notAsked } = answersToProfile(questionnaire, BASE);

  it("produces a profile that validates against the schema", () => expect(FamilyProfile.safeParse(profile).success).toBe(true));
  it("maps the answers a plan depends on", () => {
    expect(profile.person).toMatchObject({ firstName: "Margaret", preferredName: "Maggie", town: "Rangiora", region: "Canterbury", age: 82 });
    expect(profile.living).toMatchObject({ situation: "alone", ownsHome: true });
    expect(profile.mobility.fallsLast12Months).toBe(2);
    expect(profile.cognition.concern).toBe("moderate");
    expect(profile.legal).toMatchObject({ will: "yes", epoaProperty: "unsure", epoaWelfare: "no", advanceCarePlan: false });
    expect(profile.support.mainCarer).toMatchObject({ name: "Sarah", relationship: "daughter", strain: "moderate" });
    expect(profile.future).toMatchObject({ preference: "retirement_village", timeframe: "within_6_months" });
  });
  it("keeps the urgent answers apart from ordinary concerns", () => {
    expect(profile.urgent).toMatchObject({ level: "possibly" });
    expect(profile.urgent!.flags).toContain("Recent or repeated falls");
    expect(profile.urgent!.detail).toMatch(/stove/);
  });
  it("records the village preferences the matching needs", () => {
    expect(profile.village).toMatchObject({ locationPreference: "current_area", priceBand: "600k_800k", timing: "3_6_months", onSiteCare: "important" });
    expect(profile.village!.accommodationTypes).toEqual(["villa"]);
  });
  it("keeps who is already involved and what has been tried", () => {
    expect(profile.network!.professionals).toEqual(["GP"]);
    expect(profile.network!.alreadyTried).toMatch(/memory test/);
  });
  it("says what it inferred and what was never asked, instead of inventing it", () => {
    expect(inferred.join(" ")).toMatch(/drives/);
    expect(notAsked.join(" ")).toMatch(/smokeAlarms/);
    expect(profile.health.conditions).toEqual([]);
  });
  it("keeps every raw answer and the questionnaire version, so the profile can be re-derived", () => {
    expect((profile.extra as { questionnaireVersion: string }).questionnaireVersion).toBe(questionnaire.version);
    expect((profile.extra as { answers: Answers }).answers.q8).toEqual(BASE.q8);
  });
  it("refuses to build a profile when the name is missing", () => {
    expect(() => answersToProfile(questionnaire, { ...BASE, c_person_first: "" })).toThrow();
  });
});

describe("the plan built from the questionnaire", () => {
  const { profile } = answersToProfile(questionnaire, BASE);
  const plan = generatePlan(profile, builtInLibrary, { questionnaireVersion: questionnaire.version, planId: "AP-TEST02" });

  it("flags the urgent items separately from the actions", () => {
    expect(plan.summary.urgent).toBeDefined();
    expect(plan.summary.urgent!.items).toContain("Cooking or appliance safety");
    expect(plan.summary.urgent!.guidance).toMatch(/111/);
    expect(plan.actions.some((a) => a.title === "Cooking or appliance safety")).toBe(false);
  });
  it("records which questionnaire version produced it", () => expect(plan.generatedBy.questionnaireVersion).toBe(questionnaire.version));
  it("switches on the topics the answers call for", () => {
    expect(plan.modules.map((m) => m.id)).toEqual(expect.arrayContaining(["falls-and-mobility", "retirement-villages", "epoa-and-legal-planning"]));
  });
  it("gives every family something to do first", () => expect(plan.actions.some((a) => a.priority === "now")).toBe(true));
  it("leaves no urgent block when nothing was flagged", () => {
    const calm = answersToProfile(questionnaire, { ...BASE, q18: "no", q18a: [], q18a_detail: "" }).profile;
    expect(generatePlan(calm, builtInLibrary, { planId: "AP-TEST03" }).summary.urgent).toBeUndefined();
  });
});

describe("village matching uses the village answers", () => {
  const { profile } = answersToProfile(questionnaire, BASE);
  const matches = matchProviders(profile, builtInLibrary.providers, "retirement-villages", ["retirement_village"]);

  it("explains each option with the family's own criteria", () => {
    const rimu = matches.find((m) => m.name === "Rimu Grove Village");
    expect(rimu).toBeDefined();
    expect(rimu!.matched).toEqual(expect.arrayContaining(["Pets allowed", "Accommodation: villa"]));
  });
  it("says when a criterion is not met rather than hiding the option", () => {
    const harbour = matches.find((m) => m.name === "Harbourview Lifestyle Village");
    expect(harbour?.notMatched).toContain("Pets allowed");
  });
  it("never claims information it has not verified", () => {
    const unverified = matchProviders({ ...profile, person: { ...profile.person, region: "Nelson" } }, builtInLibrary.providers, "retirement-villages", ["retirement_village"]);
    expect(unverified.find((m) => m.name === "Kowhai Court Village")!.unknown).toContain("We have not confirmed this information recently");
  });
  it("keeps to at most three options and only in the right region", () => {
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches.every((m) => m.matched.some((x) => x === "Location: Canterbury"))).toBe(true);
  });
});
