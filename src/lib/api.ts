import { NextResponse } from "next/server";
import { z } from "zod";

export const noStore = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

/** Validation errors as a flat list of { path, message }, which the admin UI shows next to the JSON. */
export const issues = (e: z.ZodError) => e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

export const bad = (message: string, details?: unknown, status = 422) => NextResponse.json({ error: message, details }, { status, headers: noStore });

export async function body(req: Request, max = 512 * 1024) {
  const text = await req.text();
  if (text.length > max) throw new Error("too-large");
  return JSON.parse(text) as unknown;
}
