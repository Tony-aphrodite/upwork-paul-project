import { FamilyProfile, SCHEMA_VERSION } from "../schema";
import type { Answers, Questionnaire } from "./schema";

/**
 * Answers → Family Profile.
 *
 * This is the only place that knows both sides, so the questionnaire can be reworded and the plan modules can be
 * extended without either one knowing about the other. Two rules keep it honest:
 *  - nothing is invented: where the questionnaire does not ask, the value is recorded in `extra.notAsked`
 *    and left at a neutral default rather than treated as a concern;
 *  - where a value is worked out from other answers it is listed in `extra.inferred`, so a navigator can see it.
 * Every raw answer is kept in `extra.answers` with the questionnaire version, so a profile can always be re-derived.
 */

type Raw = string | string[] | Record<string, string> | undefined;
const str = (v: Raw): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: Raw): string[] => (Array.isArray(v) ? v : []);
const grid = (v: Raw): Record<string, string> => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const pick = <T,>(map: Record<string, T>, key: string, fallback: T): T => (key in map ? map[key] : fallback);

const AGE: Record<string, number> = { under_65: 62, "65_69": 67, "70_74": 72, "75_79": 77, "80_84": 82, "85_89": 87, "90_plus": 92 };
const LIVING: Record<string, FamilyProfile["living"]["situation"]> = { alone: "alone", with_partner: "with_partner", with_family: "with_family", village_independent: "retirement_village", village_serviced: "retirement_village", residential_care: "residential_care", in_hospital: "other", temporary: "other", other: "other", unsure: "other" };
const HOME: Record<string, FamilyProfile["living"]["homeType"]> = { village_independent: "village_unit", village_serviced: "village_unit", residential_care: "care_facility", in_hospital: "care_facility" };
const SUPPORT: Record<string, { type: FamilyProfile["support"]["current"][number]["type"]; funded?: boolean }> = {
  help_from_a_spouse_or_partner: { type: "family" }, help_from_family: { type: "family" }, help_from_friends_or_neighbours: { type: "family" },
  government_funded_home_support: { type: "home_help", funded: true }, privately_paid_home_support: { type: "home_help", funded: false },
  community_or_charitable_services: { type: "other" }, respite: { type: "other" }, retirement_village_support: { type: "other" },
  district_or_community_nursing: { type: "nursing" }, other: { type: "other" },
};
const ASSESSMENT: Record<string, FamilyProfile["funding"]["needsAssessment"]> = { none: "none", thinking: "none", requested: "requested", completed: "completed", receiving: "completed", reassessment: "completed", dont_know_what: "none", unsure: "none" };
const LEVEL: Record<string, NonNullable<FamilyProfile["funding"]["assessedLevel"]>> = { home_support: "home_support", rest_home: "rest_home", hospital: "hospital", dementia: "dementia" };
const COGNITION: Record<string, { concern: FamilyProfile["cognition"]["concern"]; diagnosis: FamilyProfile["cognition"]["diagnosis"] }> = {
  minor: { concern: "mild", diagnosis: "none" }, concerned: { concern: "moderate", diagnosis: "none" },
  affecting_daily_life: { concern: "significant", diagnosis: "unknown" }, being_assessed: { concern: "moderate", diagnosis: "unknown" },
  diagnosed: { concern: "significant", diagnosis: "dementia" }, unsure: { concern: "mild", diagnosis: "unknown" },
};
const FALLS: Record<string, number> = { none: 0, one: 1, two_three: 2, more: 4, unsure: 0 };
const PREFERENCE: Record<string, FamilyProfile["future"]["preference"]> = { stay_home: "stay_home", stay_home_if_workable: "stay_home", village: "retirement_village", serviced: "retirement_village", residential_care: "residential_care", planning_move: "retirement_village" };
const RV_TIMING: Record<string, FamilyProfile["future"]["timeframe"]> = { asap: "now", within_3_months: "within_6_months", "3_6_months": "within_6_months", "6_12_months": "within_2_years", over_a_year: "later", exploring: "later", unsure: "later" };
const DEADLINE_TIMING: Record<string, FamilyProfile["future"]["timeframe"]> = { days: "now", weeks: "now", months: "within_6_months" };
const STRAIN: Record<string, "low" | "moderate" | "high"> = { significant: "high", some: "moderate", possibly: "moderate", no: "low", unsure: "moderate" };

const newProfileId = () => `FP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** Labels rather than slugs are kept for free-form lists, so plan text reads the way the family answered. */
function labels(doc: Questionnaire, questionId: string, values: string[]): string[] {
  const q = doc.sections.flatMap((s) => s.questions).find((x) => x.id === questionId);
  const byValue = new Map((q?.options ?? []).map((o) => [o.value, o.label]));
  return values.map((v) => byValue.get(v) ?? v);
}

export type MappingResult = { profile: FamilyProfile; inferred: string[]; notAsked: string[] };

export function answersToProfile(doc: Questionnaire, answers: Answers, opts: { profileId?: string } = {}): MappingResult {
  const a = (id: string): Raw => answers[id];
  const has = (id: string, value: string) => arr(a(id)).includes(value);
  const inferred: string[] = [];
  const notAsked: string[] = [];

  const q1 = str(a("q1"));
  const selfCompleted = q1 === "self";
  const q4 = str(a("q4"));
  const age = pick(AGE, q4, 0) || (inferred.push("person.age (no age band given, 78 assumed)"), 78);

  const q6 = str(a("q6"));
  const owns = str(a("q6_owns")) === "yes" || str(a("f2")) === "yes";

  const q14 = arr(a("q14"));
  const current = q14.filter((v) => v in SUPPORT).map((v) => ({ type: SUPPORT[v].type, funded: SUPPORT[v].funded }));
  const familyHelp = q14.some((v) => v.startsWith("help_from"));
  const distance = str(a("q27"));
  const familySupport: FamilyProfile["support"]["familySupport"] = !familyHelp ? "none" : distance === "overseas" || distance === "several_elsewhere" ? "limited" : familyHelp && q14.length > 2 ? "strong" : "moderate";

  const carerText = str(a("q16_carer"));
  const [carerName, carerRel] = carerText.split(",").map((s) => s.trim());
  const q16 = str(a("q16"));
  const mainCarer = carerName ? { name: carerName, relationship: carerRel || "family", strain: pick(STRAIN, q16, "moderate") } : undefined;
  if (!carerText && (q16 === "significant" || q16 === "some")) notAsked.push("support.mainCarer (someone is under pressure but was not named)");

  const q12 = arr(a("q12")), q17 = arr(a("q17")), q9 = arr(a("q9")), q8 = arr(a("q8")), q24 = arr(a("q24"));
  const mobility: FamilyProfile["mobility"]["level"] = q12.includes("walking_or_moving_around") ? "needs_help" : q17.includes("difficulty_walking_or_moving_around") || q9.includes("walking_or_mobility_has_become_worse") ? "uses_aid" : "independent";
  if (mobility !== "independent") inferred.push("mobility.level (from the everyday activities and safety answers)");

  const drives = !q9.includes("they_have_stopped_or_reduced_driving") && !q12.includes("transport");
  inferred.push("mobility.drives (the questionnaire does not ask directly)");

  const m1 = str(a("m1"));
  const cognitionFromSection = m1 ? COGNITION[m1] : undefined;
  const memoryMentioned = q8.includes("memory_or_thinking") || q17.includes("memory_problems") || q9.includes("memory_or_thinking_has_changed");
  const cognition = cognitionFromSection ?? { concern: memoryMentioned ? ("mild" as const) : ("none" as const), diagnosis: "none" as const };

  const h1 = str(a("h1"));
  const hospitalStatus: FamilyProfile["hospital"]["status"] = h1 === "in_hospital" || h1 === "leaving_soon" || q6 === "in_hospital" ? "in_hospital" : h1 === "discharged_home" || h1 === "discharged_other" ? "discharged_recently" : "none";
  const recentAdmission = hospitalStatus !== "none" || h1 === "repeat_visits" || q9.includes("hospital_admission_or_emergency_department_visit");

  const q21 = grid(a("q21"));
  const tri = (v: string | undefined): "yes" | "no" | "unsure" => (v === "yes" || v === "no" ? v : "unsure");

  const q19 = str(a("q19")), q19Level = str(a("q19_level")), rc2 = str(a("rc2"));
  const assessedLevel = LEVEL[q19Level] ?? LEVEL[rc2];
  const q20 = str(a("q20")), f4 = str(a("f4"));
  const budgetConcern: FamilyProfile["funding"]["budgetConcern"] = q20 === "very_important" || f4 === "no" || f4 === "small_amount" ? "significant" : q20 === "important" || f4 === "cost_matters" ? "some" : "none";
  const rc1 = str(a("rc1"));

  const q23 = str(a("q23"));
  const rv7 = str(a("rv7")), q11 = str(a("q11"));
  const timeframe = RV_TIMING[rv7] ?? DEADLINE_TIMING[q11] ?? (q23 === "planning_move" ? "within_6_months" : "later");

  const isolationSignals = [q8.includes("loneliness_or_social_isolation"), q24.includes("social_isolation"), q8.includes("being_alone") || q17.includes("being_alone")].filter(Boolean).length;
  const q18 = str(a("q18"));
  const q18a = arr(a("q18a"));

  notAsked.push("homeSafety.smokeAlarms and homeSafety.personalAlarm (recorded as unknown rather than a concern)", "health.conditions (the questionnaire deliberately avoids medical detail)", "legal.epoaActivated");

  const profile: FamilyProfile = FamilyProfile.parse({
    schemaVersion: SCHEMA_VERSION,
    profileId: opts.profileId ?? newProfileId(),
    preparedFor: {
      name: str(a("c_your_name")) || "the family",
      relationship: selfCompleted ? "self" : labels(doc, "q2", [str(a("q2"))])[0] || "family member",
    },
    person: {
      firstName: str(a("c_person_first")),
      lastName: str(a("c_person_last")),
      preferredName: str(a("c_person_preferred")) || undefined,
      age,
      region: str(a("q5_region")),
      town: str(a("q5_town")),
    },
    living: {
      situation: pick(LIVING, q6, "other"),
      homeType: pick(HOME, q6, "house"),
      ownsHome: owns,
    },
    support: { current, familySupport, mainCarer },
    mobility: {
      level: mobility,
      fallsLast12Months: pick(FALLS, str(a("q17_falls")), 0),
      fearOfFalling: q17.includes("falling") || q8.includes("falls"),
      drives,
    },
    health: {
      conditions: [],
      concerns: labels(doc, "q8", q8.filter((v) => ["changes_in_health", "medication", "meals_or_nutrition", "personal_care"].includes(v))),
      medications: q12.includes("taking_or_organising_medication") || q17.includes("medication") ? "needs_help" : "self",
    },
    cognition: { ...cognition, wandering: q18a.includes("wandering_or_becoming_lost") || q17.includes("becoming_lost_or_disorientated") },
    hospital: { recentAdmission, status: hospitalStatus, reason: undefined, dischargeDate: undefined },
    homeSafety: {
      concerns: labels(doc, "q24", q24.filter((v) => !["none", "the_home_itself_is_suitable", "not_sure"].includes(v))),
      smokeAlarms: true,
      personalAlarm: !q17.includes("getting_help_in_an_emergency"),
      stairs: q24.includes("stairs"),
    },
    funding: {
      needsAssessment: pick(ASSESSMENT, q19, "none"),
      assessedLevel,
      residentialSubsidy: rc1 === "actively_looking" || rc1 === "assessment_identified" || rc1 === "urgent" ? "considering" : "not_applicable",
      budgetConcern,
    },
    legal: {
      epoaProperty: tri(q21.epoa_property),
      epoaWelfare: tri(q21.epoa_welfare),
      epoaActivated: false,
      will: tri(q21.will),
      advanceCarePlan: q21.advance_care_plan === "yes",
    },
    transport: {
      mainMode: drives ? "drives" : q12.includes("transport") ? "family" : "public",
      difficulties: q24.includes("lack_of_transport") || q12.includes("transport") || q24.includes("difficulty_getting_to_appointments_or_activities"),
    },
    social: {
      isolation: isolationSignals >= 2 ? "high" : isolationSignals === 1 ? "moderate" : "low",
      activities: [],
    },
    respite: { needed: q8.includes("respite") || q16 === "significant" || q16 === "some", used: q14.includes("respite") },
    future: { preference: pick(PREFERENCE, q23, "undecided"), timeframe, weeklyBudget: undefined },
    goals: labels(doc, "q32", arr(a("q32"))),
    notes: str(a("q33")),

    intake: {
      completedBy: (["self", "family_member", "partner", "friend", "helping_person", "helping_family", "other"].includes(q1) ? q1 : "other") as never,
      involvement: (str(a("q3")) || "unsure") as never,
      reasonNow: (str(a("q7")) || "not_sure") as never,
      deadline: (q11 || "none") as never,
      deadlineDetail: str(a("q11a")),
      worry: str(a("q10")),
    },
    everyday: {
      needsHelpWith: labels(doc, "q12", q12.filter((v) => v !== "not_sure")),
      changeSinceSixMonths: (str(a("q13")) || "unsure") as never,
      supportSufficient: (str(a("q15")) || "unsure") as never,
      carerPressure: (q16 || "unsure") as never,
    },
    urgent: {
      level: (q18 || "no") as never,
      flags: labels(doc, "q18a", q18a),
      detail: str(a("q18a_detail")),
    },
    village: {
      locationPreference: (str(a("rv1")) || "unsure") as never,
      preferredArea: str(a("rv1a")),
      accommodationTypes: arr(a("rv2")).filter((v) => v !== "unsure"),
      independence: (str(a("rv3")) || "unsure") as never,
      onSiteCare: (str(a("rv4")) || "unsure") as never,
      mattersMost: arr(a("rv5")),
      priceBand: (str(a("rv6")) || "unknown") as never,
      timing: (rv7 || "exploring") as never,
    },
    residentialCare: {
      stage: (rc1 || "future_only") as never,
      assessedLevel: (rc2 || "none") as never,
      helpWanted: labels(doc, "rc3", arr(a("rc3"))),
    },
    network: { professionals: labels(doc, "q29", arr(a("q29")).filter((v) => v !== "nobody_currently" && v !== "not_sure")), alreadyTried: str(a("q30")) },
    decisions: {
      organiser: (str(a("q28")) || "unsure") as never,
      agreement: (str(a("q26")) || "unsure") as never,
      distance: (distance || "no") as never,
      responsibilityToday: (str(a("q25")) || "unsure") as never,
    },
    barriers: labels(doc, "q31", arr(a("q31"))),
    mostUseful: labels(doc, "q32", arr(a("q32"))).slice(0, 3),

    extra: {
      questionnaireId: doc.id,
      questionnaireVersion: doc.version,
      ageBand: q4,
      completedAt: new Date().toISOString(),
      answers,
      inferred,
      notAsked,
    },
  });

  return { profile, inferred, notAsked };
}
