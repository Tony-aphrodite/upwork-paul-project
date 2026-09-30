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

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status, headers: noStore });

/** Parse a JSON body against a schema: the data, or a response to return as is. */
export async function parse<T extends z.ZodType>(req: Request, schema: T, max = 256 * 1024): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try { raw = await body(req, max); } catch { return { error: bad("Send a JSON body.", undefined, 400) }; }
  const r = schema.safeParse(raw);
  return r.success ? { data: r.data } : { error: bad("Some details are not valid.", issues(r.error)) };
}
