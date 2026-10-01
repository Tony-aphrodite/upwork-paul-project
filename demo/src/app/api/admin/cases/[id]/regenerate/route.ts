import { z } from "zod";
import { regenerate } from "@/lib/cases";
import { content } from "@/lib/pilot/library";
import { generatePilotPlan } from "@/lib/pilot/engine";
import { cleanAnswers, pruneAnswers } from "@/lib/questionnaire/logic";
import { ok, parse } from "@/lib/api";
import { caseRoute } from "@/lib/route";

export const runtime = "nodejs";

/**
 * Rebuild the working plan from the family's answers with the current content, discarding edits. For a content update
 * during testing; the released plan, if any, is not touched until the navigator releases again.
 */
export const POST = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, z.object({ version: z.number().int().positive() }), 4096);
  if ("error" in parsed) return parsed.error;
  const answers = pruneAnswers(content.questionnaire, cleanAnswers(content.questionnaire, c.answers));
  const plan = generatePilotPlan(content, answers, { firstName: c.personFirstName, preferredName: c.personPreferredName ?? undefined, contactName: c.contactName });
  return ok({ version: await regenerate(c.id, parsed.data.version, plan, plan.pathways.map((p) => p.id), !!plan.urgent, nav.id) });
});
