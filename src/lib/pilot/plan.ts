import { z } from "zod";
import { PRIORITIES } from "../schema";
import { ContentSource, INFO_SECTIONS, PathwayId } from "./content";

/**
 * A pilot Action Plan, as stored on a case. The engine writes `generated_plan`, the navigator edits a copy
 * (`working_plan`), and release freezes a snapshot (`released_plan`), which is the only one a family ever sees.
 * Limits keep an edited plan to a sensible size, since the review screen sends it back whole.
 */

const text = (max = 4000) => z.string().max(max);
const items = z.array(text(1000)).max(60);

export const PlanAction = z.object({
  key: z.string().max(80),
  topic: text(200).default(""),
  priority: z.enum(PRIORITIES),
  title: text(500).min(1),
  why: text().default(""),
  nextStep: text().default(""),
  whoCanHelp: items.default([]),
  prepare: items.default([]),
  questions: items.default([]),
  check: items.default([]),
  sourceId: z.string().max(80).optional(),
  removed: z.boolean().default(false),
});
export type PlanAction = z.infer<typeof PlanAction>;

export const PlanInfo = z.object({
  id: z.string().max(40),
  section: z.enum(INFO_SECTIONS),
  title: text(500).default(""),
  text: text().min(1),
  sourceId: z.string().max(80).optional(),
  removed: z.boolean().default(false),
});
export type PlanInfo = z.infer<typeof PlanInfo>;

export const PilotPlan = z.object({
  schema: z.literal("pilot-plan/1"),
  generatedAt: z.string(),
  contentVersion: z.string(),
  contentStatus: z.enum(["draft", "approved"]),
  questionnaireVersion: z.string(),
  personName: text(120),
  preparedFor: text(120),
  intro: text(),
  urgent: z.object({ items: items, guidance: text() }).optional(),
  situation: items,
  matters: items,
  pathways: z.array(z.object({ id: PathwayId, name: text(200), explanation: text() })).max(3),
  pathwayNote: text(),
  actions: z.array(PlanAction).max(150),
  information: z.array(PlanInfo).max(150),
  cta: text(),
  services: z.array(z.object({ id: z.string().max(80), label: text(200), suggested: z.boolean() })).max(20),
  sources: z.array(ContentSource).max(100),
  disclaimer: text(),
});
export type PilotPlan = z.infer<typeof PilotPlan>;

/** What the plan still shows: removed actions and information stay in the data, so a removal can be undone. */
export const liveActions = (p: PilotPlan) => p.actions.filter((a) => !a.removed);
export const liveInformation = (p: PilotPlan, section?: PlanInfo["section"]) => p.information.filter((i) => !i.removed && (!section || i.section === section));

/** Section G: every action's "things to check", then the information written for that section. */
export function thingsToCheck(p: PilotPlan): { text: string; from?: string }[] {
  const seen = new Set<string>();
  const out: { text: string; from?: string }[] = [];
  for (const a of liveActions(p)) for (const c of a.check) if (c.trim() && !seen.has(c)) { seen.add(c); out.push({ text: c, from: a.title }); }
  return out;
}

/** Sources that something still on the plan cites, numbered in order of first use. */
export function citedSources(p: PilotPlan) {
  const used = new Set<string>([...liveActions(p), ...liveInformation(p)].map((x) => x.sourceId).filter((x): x is string => !!x));
  return p.sources.filter((s) => used.has(s.id));
}
