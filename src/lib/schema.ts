import { z } from "zod";

/**
 * Data contracts. Zod is the single source of truth: the same definitions validate API input, type the code,
 * and export as JSON Schema (npm run schemas) for the questionnaire, AI and CRM teams.
 * Every object is "loose" in one place only (`extra`), so new questionnaire fields can arrive before the schema catches up.
 */

export const SCHEMA_VERSION = "1.0";

const tri = z.enum(["yes", "no", "unsure"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/* ------------------------------ Family Profile ------------------------------ */

export const FamilyProfile = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  profileId: z.string().regex(/^FP-[A-Z0-9]{4,12}$/, "Profile IDs look like FP-XXXX"),
  preparedFor: z.object({
    name: z.string().min(1),
    relationship: z.string().min(1).describe("Relationship to the older person, e.g. daughter"),
  }),
  person: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    preferredName: z.string().optional(),
    age: z.number().int().min(50).max(115),
    region: z.string().min(1).describe("New Zealand region, e.g. Nelson"),
    town: z.string().min(1),
  }),
  partner: z.object({ name: z.string(), age: z.number().int(), health: z.enum(["well", "some_concerns", "unwell"]) }).optional(),
  living: z.object({
    situation: z.enum(["alone", "with_partner", "with_family", "retirement_village", "residential_care", "other"]),
    homeType: z.enum(["house", "unit", "apartment", "village_unit", "care_facility"]),
    ownsHome: z.boolean(),
  }),
  support: z.object({
    current: z.array(z.object({
      type: z.enum(["family", "home_help", "personal_care", "meals", "nursing", "day_programme", "other"]),
      provider: z.string().optional(),
      hoursPerWeek: z.number().min(0).max(168).optional(),
      funded: z.boolean().optional(),
    })).default([]),
    familySupport: z.enum(["none", "limited", "moderate", "strong"]),
    mainCarer: z.object({ name: z.string(), relationship: z.string(), strain: z.enum(["low", "moderate", "high"]) }).optional(),
  }),
  mobility: z.object({
    level: z.enum(["independent", "uses_aid", "needs_help", "wheelchair"]),
    fallsLast12Months: z.number().int().min(0).max(50),
    fearOfFalling: z.boolean(),
    drives: z.boolean(),
  }),
  health: z.object({
    conditions: z.array(z.string()).default([]),
    concerns: z.array(z.string()).default([]),
    medications: z.enum(["self", "family", "pharmacy_packs", "needs_help"]),
  }),
  cognition: z.object({
    concern: z.enum(["none", "mild", "moderate", "significant"]),
    diagnosis: z.enum(["none", "mci", "dementia", "unknown"]),
    wandering: z.boolean(),
  }),
  hospital: z.object({
    recentAdmission: z.boolean(),
    status: z.enum(["none", "in_hospital", "discharged_recently"]),
    reason: z.string().optional(),
    dischargeDate: isoDate.optional(),
  }),
  homeSafety: z.object({
    concerns: z.array(z.string()).default([]),
    smokeAlarms: z.boolean(),
    personalAlarm: z.boolean(),
    stairs: z.boolean(),
  }),
  funding: z.object({
    needsAssessment: z.enum(["none", "requested", "completed"]),
    assessedLevel: z.enum(["home_support", "rest_home", "hospital", "dementia"]).optional(),
    residentialSubsidy: z.enum(["not_applicable", "considering", "applied", "approved"]),
    budgetConcern: z.enum(["none", "some", "significant"]),
  }),
  legal: z.object({
    epoaProperty: tri,
    epoaWelfare: tri,
    epoaActivated: z.boolean(),
    will: tri,
    advanceCarePlan: z.boolean(),
  }),
  transport: z.object({ mainMode: z.enum(["drives", "family", "public", "taxi", "none"]), difficulties: z.boolean() }),
  social: z.object({ isolation: z.enum(["low", "moderate", "high"]), activities: z.array(z.string()).default([]) }),
  respite: z.object({ needed: z.boolean(), used: z.boolean() }),
  future: z.object({
    preference: z.enum(["stay_home", "retirement_village", "residential_care", "undecided"]),
    timeframe: z.enum(["now", "within_6_months", "within_2_years", "later"]),
    weeklyBudget: z.number().int().min(0).optional(),
  }),
  goals: z.array(z.string()).default([]),
  notes: z.string().default(""),

  /* Added with the September questionnaire. Every group is optional so profiles written against schema 1.0 still validate. */
  intake: z.object({
    completedBy: z.enum(["self", "family_member", "partner", "friend", "helping_person", "helping_family", "other"]),
    involvement: z.enum(["active", "some", "prefers_family", "reluctant", "difficulty", "unable", "unsure"]),
    reasonNow: z.enum(["planning_ahead", "noticed_changes", "needs_more_help", "increasingly_concerned", "something_changed", "major_event", "important_decision", "struggling", "not_sure"]),
    deadline: z.enum(["none", "days", "weeks", "months", "no_deadline", "unsure"]).default("none"),
    deadlineDetail: z.string().default(""),
    worry: z.string().default("").describe("Q10, in the family's own words"),
  }).optional(),
  everyday: z.object({
    needsHelpWith: z.array(z.string()).default([]).describe("Q12 everyday activities"),
    changeSinceSixMonths: z.enum(["same", "slightly_more", "noticeably_more", "significantly_more", "varies", "unsure"]).default("same"),
    supportSufficient: z.enum(["yes", "mostly", "probably_not", "definitely_not", "none", "unsure"]).default("unsure"),
    carerPressure: z.enum(["significant", "some", "possibly", "no", "unsure"]).default("unsure"),
  }).optional(),
  /** Q18/Q18A. The questionnaire asks for these to be flagged separately from ordinary planning recommendations. */
  urgent: z.object({
    level: z.enum(["no", "possibly", "yes", "unsure"]).default("no"),
    flags: z.array(z.string()).default([]),
    detail: z.string().default(""),
  }).optional(),
  village: z.object({
    locationPreference: z.enum(["current_area", "near_family", "particular_area", "flexible", "unsure"]).default("unsure"),
    preferredArea: z.string().default(""),
    accommodationTypes: z.array(z.enum(["villa", "apartment", "serviced_apartment", "care_suite", "open"])).default([]),
    independence: z.enum(["fully_independent", "support_nearby", "some_help", "significant_needs", "increasing", "unsure"]).default("unsure"),
    onSiteCare: z.enum(["essential", "important", "nice_to_have", "not_important", "unsure"]).default("unsure"),
    mattersMost: z.array(z.string()).default([]).describe("RV5, including pets, meals, transport and dementia care"),
    priceBand: z.enum(["under_400k", "400k_600k", "600k_800k", "800k_1m", "over_1m", "unknown", "prefer_not_to_say"]).default("unknown"),
    timing: z.enum(["asap", "within_3_months", "3_6_months", "6_12_months", "over_a_year", "exploring", "unsure"]).default("exploring"),
  }).optional(),
  residentialCare: z.object({
    stage: z.enum(["future_only", "wondering", "professional_suggested", "assessment_identified", "actively_looking", "urgent", "unsure"]).default("future_only"),
    assessedLevel: z.enum(["rest_home", "hospital", "dementia", "psychogeriatric", "other", "none", "unsure"]).default("none").describe("Recorded only when a formal assessment identified it; Ageing Navigator never sets this itself"),
    helpWanted: z.array(z.string()).default([]),
  }).optional(),
  network: z.object({
    professionals: z.array(z.string()).default([]).describe("Q29, so the plan does not send families back to people already involved"),
    alreadyTried: z.string().default(""),
  }).optional(),
  decisions: z.object({
    organiser: z.enum(["older_person", "you", "partner", "other_family", "shared", "professional", "nobody", "unsure"]).default("unsure").describe("Q28, used as the default owner on new actions"),
    agreement: z.enum(["yes", "mostly", "some_differences", "significant_disagreement", "not_discussed", "unsure"]).default("unsure"),
    distance: z.enum(["no", "elsewhere_nz", "overseas", "several_elsewhere", "other"]).default("no"),
    responsibilityToday: z.enum(["older_person", "partner", "you", "other_family", "shared", "nobody", "other", "unsure"]).default("unsure"),
  }).optional(),
  barriers: z.array(z.string()).default([]).describe("Q31, what is making it hardest to move forward"),
  mostUseful: z.array(z.string()).max(3).default([]).describe("Q32, at most three"),

  extra: z.record(z.string(), z.unknown()).default({}).describe("New questionnaire fields land here until the schema adds them"),
});
export type FamilyProfile = z.infer<typeof FamilyProfile>;

/* ------------------------------ Action Plan ------------------------------ */

export const PRIORITIES = ["now", "soon", "plan_ahead"] as const;
export const Priority = z.enum(PRIORITIES);
export type Priority = z.infer<typeof Priority>;
export const PRIORITY_LABEL: Record<Priority, string> = { now: "Now", soon: "Soon", plan_ahead: "Plan ahead" };

export const STATUSES = ["not_started", "in_progress", "waiting_third_party", "completed", "no_longer_required"] as const;
export const ActionStatus = z.enum(STATUSES);
export type ActionStatus = z.infer<typeof ActionStatus>;
export const STATUS_LABEL: Record<ActionStatus, string> = { not_started: "Not started", in_progress: "In progress", waiting_third_party: "Waiting on third party", completed: "Completed", no_longer_required: "No longer required" };

export const Action = z.object({
  key: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/, "Keys are module-id:action-id").describe("Stable across versions, so status and notes carry over"),
  title: z.string().min(1),
  description: z.string(),
  priority: Priority,
  timing: z.string(),
  responsible: z.string(),
  status: ActionStatus,
  moduleId: z.string(),
  source: z.enum(["rules", "ai", "navigator", "family"]),
  notes: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Action = z.infer<typeof Action>;

export const PlanModule = z.object({
  id: z.string(),
  title: z.string(),
  priority: Priority,
  noticed: z.array(z.string()),
  whyItMatters: z.string().optional(),
  whoCanHelp: z.array(z.string()).default([]),
  questions: z.array(z.object({ for: z.string(), question: z.string() })).default([]),
  usefulInformation: z.array(z.object({ title: z.string(), body: z.string(), sourceId: z.string().optional() })).default([]),
  sourceIds: z.array(z.string()).default([]),
  actionKeys: z.array(z.string()),
});
export type PlanModule = z.infer<typeof PlanModule>;

export const ProviderMatch = z.object({
  providerId: z.string(),
  name: z.string(),
  type: z.string(),
  moduleId: z.string(),
  matched: z.array(z.string()),
  notMatched: z.array(z.string()),
  unknown: z.array(z.string()),
  verifiedOn: isoDate.optional().describe("When this provider's information was last checked; the questionnaire asks families to be told"),
});
export type ProviderMatch = z.infer<typeof ProviderMatch>;

export const Source = z.object({ id: z.string(), title: z.string(), publisher: z.string(), url: z.url(), reviewedOn: isoDate });
export type Source = z.infer<typeof Source>;

export const ChangeSet = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  changed: z.array(z.object({ key: z.string(), fields: z.array(z.string()) })),
  modulesAdded: z.array(z.string()),
  modulesRemoved: z.array(z.string()),
});
export type ChangeSet = z.infer<typeof ChangeSet>;

export const ActionPlan = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  planId: z.string().regex(/^AP-[A-Z0-9]{4,12}$/),
  profileId: z.string(),
  version: z.string().regex(/^\d+\.\d+$/),
  createdAt: z.string(),
  updatedAt: z.string(),
  generatedBy: z.object({ engine: z.string(), engineVersion: z.string(), moduleSet: z.string(), questionnaireVersion: z.string().optional().describe("Which version of the questionnaire produced the answers, so pilot feedback can be compared") }),
  profileHash: z.string().describe("Fingerprint of the profile this version was generated from"),
  summary: z.object({
    situation: z.array(z.string()),
    attention: z.array(z.string()),
    nextStep: z.string(),
    /** Q18A items, kept apart from ordinary planning recommendations as the questionnaire requires. */
    urgent: z.object({ level: z.enum(["no", "possibly", "yes", "unsure"]), items: z.array(z.string()), guidance: z.string() }).optional(),
  }),
  priorities: z.array(z.object({ moduleId: z.string(), title: z.string(), why: z.string(), level: Priority })).max(5),
  modules: z.array(PlanModule),
  actions: z.array(Action),
  providerMatches: z.array(ProviderMatch).default([]),
  sources: z.array(Source),
  history: z.array(z.object({ version: z.string(), at: z.string(), reason: z.string(), changes: ChangeSet.optional() })),
});
export type ActionPlan = z.infer<typeof ActionPlan>;

/* ------------------------------ Module definitions (content, not code) ------------------------------ */

type Cond = { all: Cond[] } | { any: Cond[] } | { not: Cond } | { field: string; op: "eq" | "neq" | "in" | "gte" | "lte" | "truthy" | "falsy" | "includes" | "exists"; value?: unknown };
export const Condition: z.ZodType<Cond> = z.lazy(() => z.union([
  z.object({ all: z.array(Condition) }).strict(),
  z.object({ any: z.array(Condition) }).strict(),
  z.object({ not: Condition }).strict(),
  z.object({ field: z.string(), op: z.enum(["eq", "neq", "in", "gte", "lte", "truthy", "falsy", "includes", "exists"]), value: z.unknown().optional() }).strict(),
]));
export type Condition = Cond;

const Guarded = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, when: Condition.optional() });

export const ModuleDefinition = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  order: z.number().int(),
  when: Condition.describe("The module appears only when this is true"),
  priority: z.object({ default: Priority, rules: z.array(z.object({ when: Condition, level: Priority })).default([]) }),
  headline: z.string().describe("Short title used in Top Priorities"),
  noticed: z.array(Guarded({ text: z.string() })).min(1),
  whyItMatters: z.string().optional(),
  whoCanHelp: z.array(z.string()).default([]),
  questions: z.array(Guarded({ for: z.string(), question: z.string() })).default([]),
  information: z.array(Guarded({ title: z.string(), body: z.string(), sourceId: z.string().optional() })).default([]),
  actions: z.array(Guarded({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    description: z.string(),
    timing: z.string(),
    responsible: z.string(),
    priority: Priority.optional().describe("Defaults to the module's priority"),
  })).min(1),
  providerTypes: z.array(z.string()).default([]),
});
export type ModuleDefinition = z.infer<typeof ModuleDefinition>;

export const Provider = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["retirement_village", "home_care", "residential_care", "community", "legal", "equipment"]),
  regions: z.array(z.string()),
  careLevels: z.array(z.string()).default([]),
  dementiaSupport: z.boolean().optional(),
  weeklyCostFrom: z.number().optional(),
  availability: z.enum(["available", "waitlist", "unknown"]),
  /* Added for the village questions (RV1 to RV7). Anything left out is reported as "not confirmed" rather than assumed. */
  accommodationTypes: z.array(z.enum(["villa", "apartment", "serviced_apartment", "care_suite"])).default([]),
  petsAllowed: z.boolean().optional(),
  purchaseFrom: z.number().optional().describe("Indicative entry price for a villa or apartment, in NZD"),
  features: z.array(z.string()).default([]).describe("Matched against RV5, e.g. meals, transport, social activities, garden"),
  town: z.string().optional(),
  verifiedOn: isoDate.optional().describe("When a navigator last checked this record"),
});
export type Provider = z.infer<typeof Provider>;
