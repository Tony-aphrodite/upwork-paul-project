import { z } from "zod";
import { setRequestStatus } from "@/lib/cases";
import { REQUEST_STATUSES } from "@/lib/case-status";
import { bad, ok, parse } from "@/lib/api";
import { adminRoute } from "@/lib/route";

export const runtime = "nodejs";

export const PATCH = adminRoute<{ id: string }>(async (req, nav, { id }) => {
  const parsed = await parse(req, z.object({ status: z.enum(REQUEST_STATUSES) }), 4096);
  if ("error" in parsed) return parsed.error;
  return (await setRequestStatus(id, parsed.data.status, nav.id)) ? ok() : bad("Request not found.", undefined, 404);
});
