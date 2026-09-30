import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { getCase, setClosed } from "@/lib/cases";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, z.object({ closed: z.boolean() }), 4096);
  if ("error" in parsed) return parsed.error;
  if (!(await getCase(id))) return bad("Case not found.", undefined, 404);
  await setClosed(id, parsed.data.closed, nav.id);
  return ok();
}
