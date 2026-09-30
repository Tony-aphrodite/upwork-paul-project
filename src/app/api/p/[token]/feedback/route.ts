import { z } from "zod";
import { caseForToken } from "@/lib/family-link";
import { saveFeedback } from "@/lib/cases";
import { hit } from "@/lib/ratelimit";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

const Input = z.object({
  useful: z.enum(["very", "somewhat", "not_really"]),
  madeSense: z.enum(["yes", "partly", "no"]),
  missing: z.string().trim().max(2000).optional().default(""),
  confusing: z.string().trim().max(2000).optional().default(""),
  wantsHelp: z.boolean().optional().default(false),
});

/** The pilot's feedback questions (build brief section 41), saved with the case. Sending again replaces the answer. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await caseForToken(token);
  if (!c) return bad("This link is not valid any more.", undefined, 404);
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  if (!(await hit(`feedback:${c.linkId}`, 10, 86_400))) return bad("Thank you, we have your feedback.", undefined, 429);
  await saveFeedback(c.id, parsed.data);
  return ok();
}
