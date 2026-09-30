import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { Conflict, deleteCase, getCase, saveWorking } from "@/lib/cases";
import { PilotPlan } from "@/lib/pilot/plan";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const Save = z.object({ version: z.number().int().positive(), plan: PilotPlan, note: z.string().max(5000).default("") });

/** Save the navigator's edits to the working plan. Refused if someone else saved first. */
export async function PATCH(req: Request, { params }: Ctx) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, Save, 1024 * 1024);
  if ("error" in parsed) return parsed.error;
  if (!(await getCase(id))) return bad("Case not found.", undefined, 404);
  try {
    return ok({ version: await saveWorking(id, parsed.data.version, parsed.data.plan, parsed.data.note, nav.id) });
  } catch (e) {
    if (e instanceof Conflict) return bad(e.message, undefined, 409);
    throw e;
  }
}

const Delete = z.object({ confirm: z.string() });

/** Delete the case now, with its link and requests. The navigator types the case reference to confirm. */
export async function DELETE(req: Request, { params }: Ctx) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, Delete, 4096);
  if ("error" in parsed) return parsed.error;
  const c = await getCase(id);
  if (!c) return bad("Case not found.", undefined, 404);
  if (parsed.data.confirm.trim().toUpperCase() !== c.reference) return bad(`Type ${c.reference} to confirm.`);
  await deleteCase(id, nav.id);
  return ok();
}
