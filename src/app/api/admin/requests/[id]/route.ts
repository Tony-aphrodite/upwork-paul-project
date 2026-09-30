import { z } from "zod";
import { NextResponse } from "next/server";
import { navigatorOr401 } from "@/lib/session";
import { setRequestStatus } from "@/lib/cases";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const nav = await navigatorOr401(req);
  if (nav instanceof NextResponse) return nav;
  const { id } = await params;
  const parsed = await parse(req, z.object({ status: z.enum(["new", "contacted", "closed"]) }), 4096);
  if ("error" in parsed) return parsed.error;
  return (await setRequestStatus(id, parsed.data.status, nav.id)) ? ok() : bad("Request not found.", undefined, 404);
}
