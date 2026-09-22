import { NextResponse } from "next/server";
import { z } from "zod";
import { Answers } from "@/lib/questionnaire/schema";
import { questionnaire } from "@/lib/questionnaire/library";
import { checkAll, pruneAnswers } from "@/lib/questionnaire/logic";
import { answersToProfile } from "@/lib/questionnaire/map";
import { builtInLibrary } from "@/lib/library";
import { generatePlan } from "@/lib/engine/generate";
import { bad, body, issues, noStore } from "@/lib/api";
import { log } from "@/lib/log";

const Input = z.object({ answers: Answers });

/**
 * Public: a family submits their answers and gets their Action Plan back.
 * Nothing is stored here. The answers arrive with the request, the plan is returned to the browser, and in the pilot a
 * navigator reviews it before it is sent. Plans carry the questionnaire version they came from.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await body(req); } catch { return bad("Send a JSON body under 512 kB.", undefined, 400); }
  const input = Input.safeParse(raw);
  if (!input.success) return bad("The answers could not be read.", issues(input.error));

  const answers = pruneAnswers(questionnaire, input.data.answers);
  const unanswered = checkAll(questionnaire, answers);
  if (unanswered.length) return bad("Some questions still need an answer.", unanswered.map((u) => ({ path: u.questionId, message: u.message })));

  try {
    const t = Date.now();
    const { profile, inferred, notAsked } = answersToProfile(questionnaire, answers);
    const plan = generatePlan(profile, builtInLibrary, { reason: `Questionnaire ${questionnaire.version}`, questionnaireVersion: questionnaire.version });
    log("questionnaire.plan", { planId: plan.planId, version: questionnaire.version, modules: plan.modules.length, actions: plan.actions.length, ms: Date.now() - t });
    return NextResponse.json({ plan, profile, mapping: { inferred, notAsked } }, { headers: noStore });
  } catch (e) {
    if (e instanceof z.ZodError) return bad("The answers do not give us enough to build a profile.", issues(e));
    log("questionnaire.failed");
    return bad(e instanceof Error ? e.message : "The plan could not be generated.", undefined, 500);
  }
}
