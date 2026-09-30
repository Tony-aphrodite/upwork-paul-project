import { purgeExpired } from "@/lib/cases";
import { bad, ok } from "@/lib/api";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Daily retention job (vercel.json crons). Vercel sends "Authorization: Bearer $CRON_SECRET"; without the secret
 * configured the job refuses to run rather than being open to anyone.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return bad("CRON_SECRET is not set.", undefined, 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return bad("Not allowed.", undefined, 401);
  const deleted = await purgeExpired();
  log("retention.run", { count: deleted });
  return ok({ deleted });
}
