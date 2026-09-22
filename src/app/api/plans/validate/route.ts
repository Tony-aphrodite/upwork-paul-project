import { NextResponse } from "next/server";
import { ActionPlan } from "@/lib/schema";
import { bad, body, issues, noStore } from "@/lib/api";

/**
 * Check a structured Action Plan from elsewhere, for example an AI model's output, before it is saved or rendered.
 * Returns every problem with its path, so the producing system can be corrected rather than guessed around.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await body(req); } catch { return bad("Send a JSON body under 512 kB.", undefined, 400); }
  const r = ActionPlan.safeParse(raw);
  if (!r.success) return NextResponse.json({ ok: false, errors: issues(r.error) }, { headers: noStore });
  const keys = new Set(r.data.actions.map((a) => a.key));
  const dangling = r.data.modules.flatMap((m) => m.actionKeys.filter((k) => !keys.has(k)).map((k) => ({ path: `modules.${m.id}.actionKeys`, message: `No action with key ${k}` })));
  return NextResponse.json({ ok: dangling.length === 0, errors: dangling }, { headers: noStore });
}
