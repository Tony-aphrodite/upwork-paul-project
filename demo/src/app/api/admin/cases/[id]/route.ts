import { z } from "zod";
import { deleteCase, saveWorking } from "@/lib/cases";
import { PilotPlan } from "@/lib/pilot/plan";
import { bad, ok, parse } from "@/lib/api";
import { caseRoute } from "@/lib/route";

export const runtime = "nodejs";

const Save = z.object({ version: z.number().int().positive(), plan: PilotPlan, note: z.string().max(5000).default("") });

/**
 * Save the navigator's edits to the working plan; refused (409) if someone else saved first. Navigators edit wording
 * only: the plan's sources, services and generation details are taken from the stored plan, whatever is sent.
 */
export const PATCH = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, Save, 1024 * 1024);
  if ("error" in parsed) return parsed.error;
  const stored = c.workingPlan;
  const plan: PilotPlan = {
    ...parsed.data.plan,
    schema: stored.schema, generatedAt: stored.generatedAt, contentVersion: stored.contentVersion, contentStatus: stored.contentStatus,
    questionnaireVersion: stored.questionnaireVersion, sources: stored.sources, services: stored.services, disclaimer: stored.disclaimer,
  };
  return ok({ version: await saveWorking(c.id, parsed.data.version, plan, parsed.data.note, nav.id) });
});

/** Delete the case now, with its link and requests. The navigator types the case reference to confirm. */
export const DELETE = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, z.object({ confirm: z.string().max(40) }), 4096);
  if ("error" in parsed) return parsed.error;
  if (parsed.data.confirm.trim().toUpperCase() !== c.reference) return bad(`Type ${c.reference} to confirm.`);
  await deleteCase(c.id, nav.id);
  return ok();
});
