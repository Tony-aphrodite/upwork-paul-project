import { z } from "zod";
import { saveFeedback } from "@/lib/cases";
import { MADE_SENSE, USEFUL } from "@/lib/case-status";
import { hit } from "@/lib/ratelimit";
import { bad, ok, parse } from "@/lib/api";
import { familyRoute } from "@/lib/route";
import { LIMITS } from "@/lib/validate";

export const runtime = "nodejs";

const values = <T extends readonly (readonly [string, string])[]>(xs: T) => xs.map(([v]) => v) as [T[number][0], ...T[number][0][]];
const Input = z.object({
  useful: z.enum(values(USEFUL)),
  madeSense: z.enum(values(MADE_SENSE)),
  missing: z.string().trim().max(LIMITS.message).optional().default(""),
  confusing: z.string().trim().max(LIMITS.message).optional().default(""),
  wantsHelp: z.boolean().optional().default(false),
});

/** The pilot's feedback questions (build brief section 41), saved with the case. Sending again replaces the answer. */
export const POST = familyRoute(async (req, c) => {
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  if (!(await hit(`feedback:${c.linkId}`, 10, 86_400))) return bad("We have your feedback already. Thank you.", undefined, 429);
  await saveFeedback(c.id, parsed.data);
  return ok();
});
