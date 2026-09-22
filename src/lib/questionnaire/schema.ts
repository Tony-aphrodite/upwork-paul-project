import { z } from "zod";
import { Condition } from "../schema";

/**
 * The questionnaire is content, not code. Questions, options, help text and the "only show this if" rules all live in
 * content/questionnaire.json, validated here. Adding, rewording or reordering a question is an edit and a new version;
 * plans record which version produced them, so pilot feedback can be compared across changes.
 */

export const QUESTION_TYPES = ["single", "multi", "short", "long", "tri_grid"] as const;
export const Option = z.object({ value: z.string().min(1), label: z.string().min(1) });
export type Option = z.infer<typeof Option>;

export const QuestionDefinition = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  type: z.enum(QUESTION_TYPES),
  label: z.string().min(1),
  help: z.string().optional(),
  format: z.enum(["email"]).optional(),
  optional: z.boolean().default(false),
  /** Multi-select only: the most options a family may choose, as Q32 ("choose up to three") requires. */
  max: z.number().int().positive().optional(),
  options: z.array(Option).default([]),
  /** tri_grid only: one row per document, each answered with the same options. */
  items: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), label: z.string() })).default([]),
  when: Condition.optional().describe("Evaluated against the answers given so far"),
}).superRefine((q, ctx) => {
  if ((q.type === "single" || q.type === "multi" || q.type === "tri_grid") && q.options.length < 2) ctx.addIssue({ code: "custom", message: `${q.id}: ${q.type} questions need at least two options`, path: ["options"] });
  if (q.type === "tri_grid" && q.items.length < 1) ctx.addIssue({ code: "custom", message: `${q.id}: a grid needs at least one row`, path: ["items"] });
  if (q.max !== undefined && q.type !== "multi") ctx.addIssue({ code: "custom", message: `${q.id}: max only applies to multi-select questions`, path: ["max"] });
});
export type QuestionDefinition = z.infer<typeof QuestionDefinition>;

export const QuestionnaireSection = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(1),
  intro: z.string().optional(),
  conditional: z.boolean().default(false).describe("Shown as a conditional section in the progress bar"),
  when: Condition.optional(),
  questions: z.array(QuestionDefinition).min(1),
});
export type QuestionnaireSection = z.infer<typeof QuestionnaireSection>;

export const Questionnaire = z.object({
  id: z.string(),
  version: z.string().describe("Shown on the plan, so answers can be read against the questions that were asked"),
  title: z.string(),
  intro: z.array(z.string()).default([]),
  notice: z.string().describe("The scope limits the service must state: no diagnosis, no legal or financial advice, no formal assessment"),
  sections: z.array(QuestionnaireSection).min(1),
}).superRefine((doc, ctx) => {
  const seen = new Set<string>();
  for (const s of doc.sections) for (const q of s.questions) {
    if (seen.has(q.id)) ctx.addIssue({ code: "custom", message: `Duplicate question id: ${q.id}`, path: ["sections"] });
    seen.add(q.id);
  }
});
export type Questionnaire = z.infer<typeof Questionnaire>;

/** One answer per question: a value, a list of values, free text, or a row per document for a grid. */
export const Answer = z.union([z.string(), z.array(z.string()), z.record(z.string(), z.string())]);
export const Answers = z.record(z.string(), Answer);
export type Answers = z.infer<typeof Answers>;
