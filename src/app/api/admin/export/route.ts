import { exportRows, logEvent } from "@/lib/cases";
import { casesCsv } from "@/lib/csv";
import { content } from "@/lib/pilot/library";
import { db } from "@/lib/db";
import { noStore } from "@/lib/api";
import { adminRoute } from "@/lib/route";

export const runtime = "nodejs";

/** All cases as CSV for the pilot evaluation, without contact details or free text. The download is recorded. */
export const GET = adminRoute(async (_req, nav) => {
  const csv = casesCsv(await exportRows(), content.questionnaire);
  await logEvent(await db(), null, nav.id, "exported");
  const day = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ageing-navigator-cases-${day}.csv"` } });
});
