import { NextResponse } from "next/server";
import { z } from "zod";

export const noStore = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

/** Validation errors as a flat list of { path, message }. */
export const issues = (e: z.ZodError) => e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));

export const bad = (message: string, details?: unknown, status = 422) => NextResponse.json({ error: message, details }, { status, headers: noStore });
export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status, headers: noStore });

class TooLarge extends Error {}

async function body(req: Request, max: number) {
  const text = await req.text();
  if (text.length > max) throw new TooLarge();
  return JSON.parse(text) as unknown;
}

/** Parse a JSON body against a schema: the data, or a response to return as is (400 unreadable, 413 too large, 422 invalid). */
export async function parse<T extends z.ZodType>(req: Request, schema: T, max = 256 * 1024): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try { raw = await body(req, max); } catch (e) { return { error: e instanceof TooLarge ? bad("That is too much to send at once.", undefined, 413) : bad("Send a JSON body.", undefined, 400) }; }
  const r = schema.safeParse(raw);
  return r.success ? { data: r.data } : { error: bad("Some details are not valid.", issues(r.error)) };
}
