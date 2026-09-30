import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { Conflict, getCase, regenerate } from "@/lib/cases";
import { content } from "@/lib/pilot/library";
import { generatePilotPlan } from "@/lib/pilot/engine";
import { pruneAnswers } from "@/lib/questionnaire/logic";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

/** Rebuild the plan from the family's answers with the current content, discarding edits. Used after a content update. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, z.object({ version: z.number().int().positive() }), 4096);
  if ("error" in parsed) return parsed.error;
  const c = await getCase(id);
  if (!c) return bad("Case not found.", undefined, 404);
  const answers = pruneAnswers(content.questionnaire, c.answers);
  const plan = generatePilotPlan(content, answers, { firstName: c.personFirstName, preferredName: c.personPreferredName ?? undefined, contactName: c.contactName });
  try {
    return ok({ version: await regenerate(id, parsed.data.version, plan, plan.pathways.map((p) => p.id), !!plan.urgent, nav.id) });
  } catch (e) {
    if (e instanceof Conflict) return bad(e.message, undefined, 409);
    throw e;
  }
}
