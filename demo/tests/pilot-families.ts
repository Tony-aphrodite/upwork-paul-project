import type { Answers } from "../src/lib/questionnaire/schema";

/**
 * Fictional families for tests and for the acceptance run. Names are invented; the phone number is the placeholder
 * 0123456789. Each family answers every required question the questionnaire shows them.
 */

export type Family = {
  id: string;
  person: { firstName: string; preferredName?: string; contactName: string };
  contact: { email: string; phone: string };
  answers: Answers;
  expect: { pathways: string[]; actions: string[]; notActions?: string[]; urgent?: boolean };
};

const base: Answers = {
  trigger: ["fall"],
  q1: "family_member", q2: "son_daughter", q3: "some", q4: "80_84", q5_town: "Tauranga", q5_region: "Bay of Plenty",
  q6: "alone", q6_owns: "yes",
  q8: ["falls", "safety_at_home"], q9: ["a_fall"], q11: "none",
  q12: ["housework", "shopping"], q13: "noticeably_more", q14: ["help_from_family"], q15: "probably_not", q16: "no",
  q17: ["falling"], q17_falls: "two_three", q18: "no",
  q19: "none", q20: "general",
  q21: { will: "yes", epoa_property: "yes", epoa_welfare: "yes", advance_care_plan: "no" }, q22: "yes",
  q23: "stay_home", q24: ["stairs", "bathroom_safety"],
  q25: "you", q26: "yes", q27: "no", q28: "you",
  q29: ["gp"], q31: ["we_don_t_know_what_to_do_first"], q32: ["knowing_what_we_should_do_first", "making_the_home_safer"],
};

const village: Answers = { rv1: "near_family", rv2: ["villa"], rv3: "fully_independent", rv4: "important", rv5: ["pets_allowed", "being_close_to_family"], rv6: "600k_800k", rv7: "6_12_months" };
const contact = (n: number) => ({ email: `family${n}@example.test`, phone: "0123456789" });

export const FAMILIES: Family[] = [
  {
    id: "stay-home-falls",
    person: { firstName: "Margaret", preferredName: "Peggy", contactName: "Anna Fictional" }, contact: contact(1),
    answers: base,
    expect: { pathways: ["stay_home"], actions: ["falls", "personal-alarm", "more-help-at-home", "needs-assessment", "home-safety", "advance-care-plan"], notActions: ["village-shortlist", "epoa", "hospital-discharge"] },
  },
  {
    id: "dementia-carer",
    person: { firstName: "Harold", contactName: "Susan Fictional" }, contact: contact(2),
    answers: {
      ...base, trigger: ["dementia_diagnosis"], q6: "with_partner", q8: ["memory_or_thinking"], q9: ["memory_or_thinking_has_changed"],
      q16: "significant", q16_carer: "Susan, wife", q17: ["memory_problems"], q17_falls: "none",
      m1: "diagnosed", m2: ["forgetting_appointments_or_tasks", "driving"],
      q21: { will: "yes", epoa_property: "unsure", epoa_welfare: "no", advance_care_plan: "no" }, q23: "stay_home_if_workable", q24: ["none"],
    },
    expect: { pathways: ["stay_home"], actions: ["dementia-support", "carer-support", "respite", "epoa", "driving"], notActions: ["memory-gp", "personal-alarm"] },
  },
  {
    id: "hospital-urgent",
    person: { firstName: "Joan", contactName: "Rewi Fictional" }, contact: contact(3),
    answers: {
      ...base, trigger: ["hospital"], q6: "in_hospital", q8: ["recent_hospital_admission_or_discharge"], q9: ["hospital_admission_or_emergency_department_visit"],
      h1: "leaving_soon", h2: "within_a_week", h3: ["whether_they_will_be_safe_at_home", "personal_care"],
      q18: "yes", q18a: ["hospital_discharge_without_enough_support"], q23: "unsure",
    },
    expect: { pathways: [], actions: ["urgent-first", "hospital-discharge"], urgent: true },
  },
  {
    id: "village-planning",
    person: { firstName: "Colin", contactName: "Colin Fictional" }, contact: contact(4),
    answers: {
      ...base, ...village, trigger: ["planning_ahead", "considering_village"], q1: "self", q2: undefined as never,
      q8: ["planning_ahead_for_ageing", "retirement_villages"], q9: ["nothing_significant_has_changed"], q12: ["they_are_currently_mostly_independent"],
      q13: "same", q15: "yes", q17: ["none_of_these"], q17_falls: "none", q23: "village", q24: ["home_is_too_large_to_manage"],
    },
    expect: { pathways: ["village"], actions: ["village-shortlist", "village-legal", "future-wishes"], notActions: ["residential-search", "needs-assessment", "falls"] },
  },
  {
    id: "residential-assessed",
    person: { firstName: "Iris", contactName: "Tom Fictional" }, contact: contact(5),
    answers: {
      ...base, trigger: ["considering_residential", "support_needs"], q6: "with_family", q8: ["residential_care", "paying_for_care"], q9: ["they_need_more_help_with_everyday_activities"],
      q19: "completed", q19_level: "rest_home", q20: "very_important", f1: "widowed", f2: "yes", f3: "150k_300k", f4: "cost_matters",
      q23: "residential_care", rc1: "actively_looking", rc2: "rest_home", rc3: ["costs", "current_availability"],
    },
    expect: { pathways: ["residential"], actions: ["residential-search", "residential-funding", "funding-pathways"], notActions: ["residential-assessment", "needs-assessment"] },
  },
  {
    id: "not-sure",
    person: { firstName: "Frank", contactName: "Mele Fictional" }, contact: contact(6),
    answers: {
      ...base, trigger: ["not_sure"], q6: "with_family", q8: ["i_m_not_sure_what_we_should_be_concerned_about"], q9: ["not_sure"],
      q17: ["not_sure"], q17_falls: "unsure", q23: "not_discussed", q24: ["not_sure"],
    },
    expect: { pathways: ["stay_home"], actions: ["future-wishes"], notActions: ["falls"] },
  },
  {
    id: "two-pathways",
    person: { firstName: "Betty", contactName: "Grace Fictional" }, contact: contact(7),
    answers: { ...base, ...village, trigger: ["considering_village", "mobility"], q8: ["mobility_or_getting_around", "retirement_villages"], q23: "stay_home_if_workable" },
    expect: { pathways: ["stay_home", "village"], actions: ["village-shortlist", "falls"] },
  },
];

// The self-completing family has no relationship answer.
for (const f of FAMILIES) for (const [k, v] of Object.entries(f.answers)) if (v === undefined) delete f.answers[k];
