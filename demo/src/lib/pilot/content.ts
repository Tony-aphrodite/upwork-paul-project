import { z } from "zod";
import { Condition } from "../rules/condition";
import { PRIORITIES } from "../priority";
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
const RowId = z.string().regex(/^[a-z0-9_-]+$/, "Use lower-case letters, numbers, hyphens and underscores");
export const ContentSummary = z.object({ id: RowId, section: z.enum(["situation", "matters"]), text: z.string().min(1), approved: z.boolean(), ...Guard });
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
  id: RowId,
  section: z.enum(INFO_SECTIONS),
  title: z.string().default(""),
  text: z.string().min(1),
  sourceId: z.string().optional(),
  approved: z.boolean(),
  ...Guard,
});
export const ContentService = z.object({ id: z.string().regex(/^[a-z0-9_-]+$/), label: z.string().min(1), pathway: PathwayId.optional() });
/** Web addresses must be http(s): anything else (javascript:, data:) could run in a family's browser. */
export const WebUrl = z.url({ protocol: /^https?$/, message: "Use a web address starting with https://" });
export const ContentSource = z.object({ id: z.string().min(1), title: z.string().min(1), publisher: z.string().default(""), url: WebUrl, lastChecked: isoDate });

/** Texts the app needs. Missing optional ones simply leave their feature out (for example marketing consent). */
export const TEXT_KEYS = {
  required: [
    "home_heading", "home_intro", "notice", "consent", "consent_checkbox", "thank_you", "urgent_guidance",
    "plan_intro", "plan_cover_note", "disclaimer", "pathway_none", "cta_default",
    "email_release_subject", "email_release_body", "request_intro", "request_done",
  ],
  optional: ["home_eyebrow", "marketing_consent", "cta_stay_home", "cta_village", "cta_residential", "feedback_intro", "questionnaire_title", "questionnaire_intro", "contact_intro"],
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
  if (c.texts.email_release_body && !c.texts.email_release_body.includes("{{link}}")) ctx.addIssue({ code: "custom", message: "Texts: email_release_body must contain {{link}}, or the family cannot open their plan", path: ["texts", "email_release_body"] });
  const unique = (tab: "actions" | "summary" | "information", ids: string[], what: string) => ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) ctx.addIssue({ code: "custom", message: `${what} "${id}" is used twice`, path: [tab, i] });
  });
  unique("actions", c.actions.map((a) => a.key), "The key");
  unique("summary", c.summary.map((s) => s.id), "The ID");
  unique("information", c.information.map((s) => s.id), "The ID");
  const sources = new Set(c.sources.map((s) => s.id));
  const cite = (tab: "actions" | "information", rows: { sourceId?: string }[]) => rows.forEach((r, i) => {
    if (r.sourceId && !sources.has(r.sourceId)) ctx.addIssue({ code: "custom", message: `Source "${r.sourceId}" is not in the Sources tab`, path: [tab, i, "sourceId"] });
  });
  cite("actions", c.actions);
  cite("information", c.information);
});
export type PilotContent = z.infer<typeof PilotContent>;
export type ContentAction = z.infer<typeof ContentAction>;
