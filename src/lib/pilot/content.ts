import { z } from "zod";
import { Condition, PRIORITIES } from "../schema";
import { Questionnaire } from "../questionnaire/schema";

/**
 * The pilot's content: everything Ageing Navigator writes and approves. It arrives in the content spreadsheet, is
 * compiled by `sheet.ts` and saved as `content/pilot/content.json`, which is what the app reads. Conditions are kept
 * both compiled (`when`) and as written (`whenText`), so the spreadsheet can be regenerated without loss.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Guard = { when: Condition.optional(), whenText: z.string().default("") };

export const PATHWAY_IDS = ["stay_home", "village", "residential"] as const;
export const PathwayId = z.enum(PATHWAY_IDS);
export type PathwayId = z.infer<typeof PathwayId>;

export const ContentPathway = z.object({ id: PathwayId, name: z.string().min(1), explanation: z.string().min(1), approved: z.boolean(), ...Guard });
export const ContentSummary = z.object({ section: z.enum(["situation", "matters"]), text: z.string().min(1), approved: z.boolean(), ...Guard });
export const ContentAction = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/, "Use lower-case letters, numbers and hyphens"),
  topic: z.string().default(""),
  priority: z.enum(PRIORITIES),
  title: z.string().min(1).describe("What to do"),
  why: z.string().default(""),
  nextStep: z.string().default(""),
  whoCanHelp: z.array(z.string()).default([]),
  prepare: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  check: z.array(z.string()).default([]),
  sourceId: z.string().optional(),
  approved: z.boolean(),
  ...Guard,
});
export const INFO_SECTIONS = ["funding", "check", "professional"] as const;
export const ContentInformation = z.object({
  section: z.enum(INFO_SECTIONS),
  title: z.string().default(""),
  text: z.string().min(1),
  sourceId: z.string().optional(),
  approved: z.boolean(),
  ...Guard,
});
export const ContentService = z.object({ id: z.string().regex(/^[a-z0-9_-]+$/), label: z.string().min(1), pathway: PathwayId.optional() });
export const ContentSource = z.object({ id: z.string().min(1), title: z.string().min(1), publisher: z.string().default(""), url: z.url(), lastChecked: isoDate });

/** Texts the app needs. Missing optional ones simply leave their feature out (for example marketing consent). */
export const TEXT_KEYS = {
  required: ["notice", "consent", "thank_you", "urgent_guidance", "plan_intro", "disclaimer", "pathway_none", "cta_default", "email_release_subject", "email_release_body", "request_intro"],
  optional: ["marketing_consent", "cta_stay_home", "cta_village", "cta_residential", "feedback_intro", "questionnaire_title", "questionnaire_intro"],
} as const;

export const PilotContent = z.object({
  version: z.string().min(1),
  status: z.enum(["draft", "approved"]),
  questionnaire: Questionnaire,
  settings: z.object({
    urgentWhen: Condition.optional(),
    urgentWhenText: z.string().default(""),
    urgentItemsQuestion: z.string().optional(),
  }),
  pathways: z.array(ContentPathway),
  summary: z.array(ContentSummary),
  actions: z.array(ContentAction),
  information: z.array(ContentInformation),
  texts: z.record(z.string(), z.string()),
  services: z.array(ContentService).min(1),
  sources: z.array(ContentSource),
}).superRefine((c, ctx) => {
  for (const k of TEXT_KEYS.required) if (!c.texts[k]?.trim()) ctx.addIssue({ code: "custom", message: `Texts: "${k}" is missing`, path: ["texts", k] });
  const keys = c.actions.map((a) => a.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) ctx.addIssue({ code: "custom", message: `Actions: the key "${dup}" is used twice`, path: ["actions"] });
  const sources = new Set(c.sources.map((s) => s.id));
  for (const [i, r] of [...c.actions, ...c.information].entries()) {
    if (r.sourceId && !sources.has(r.sourceId)) ctx.addIssue({ code: "custom", message: `Source "${r.sourceId}" is not in the Sources tab`, path: [i < c.actions.length ? "actions" : "information", i] });
  }
});
export type PilotContent = z.infer<typeof PilotContent>;
export type ContentAction = z.infer<typeof ContentAction>;
