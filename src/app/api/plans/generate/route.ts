import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionPlan, FamilyProfile } from "@/lib/schema";
import { builtInLibrary, withModules } from "@/lib/library";
import { generatePlan } from "@/lib/engine/generate";
import { bad, body, issues, noStore } from "@/lib/api";
import { log } from "@/lib/log";

const Input = z.object({ profile: FamilyProfile, previous: ActionPlan.optional(), reason: z.string().max(200).optional(), customModules: z.array(z.unknown()).default([]) });

/** Profile (and optionally the previous version) in, structured Action Plan out. Stateless: storage is the caller's job. */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await body(req); } catch { return bad("Send a JSON body under 512 kB.", undefined, 400); }
  const input = Input.safeParse(raw);
  if (!input.success) return bad("The profile does not match the schema.", issues(input.error));
  const { profile, previous, reason, customModules } = input.data;
  if (previous && previous.profileId !== profile.profileId) return bad("The previous plan belongs to a different profile.");
  try {
    const t = Date.now();
    const lib = withModules(builtInLibrary, customModules);
    const plan = generatePlan(profile, lib, { previous, reason });
    log("plan.generated", { planId: plan.planId, profileId: plan.profileId, version: plan.version, modules: plan.modules.length, actions: plan.actions.length, ms: Date.now() - t });
    return NextResponse.json({ plan }, { headers: noStore });
  } catch (e) {
    if (e instanceof z.ZodError) return bad("A custom module is not valid.", issues(e));
    log("plan.failed");
    return bad(e instanceof Error ? e.message : "The plan could not be generated.", undefined, 500);
  }
}
