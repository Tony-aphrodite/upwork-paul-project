import { z } from "zod";
import { setClosed } from "@/lib/cases";
import { ok, parse } from "@/lib/api";
import { caseRoute } from "@/lib/route";

export const runtime = "nodejs";

/** Close or reopen a case; checked against the version like an edit. Returns the new version. */
export const POST = caseRoute(async (req, nav, c) => {
  const parsed = await parse(req, z.object({ closed: z.boolean(), version: z.number().int().positive() }), 4096);
  if ("error" in parsed) return parsed.error;
  return ok({ version: await setClosed(c.id, parsed.data.version, parsed.data.closed, nav.id) });
});
