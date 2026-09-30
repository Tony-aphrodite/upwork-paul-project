import { z } from "zod";
import { caseForToken } from "@/lib/family-link";
import { addRequest } from "@/lib/cases";
import { notifyNavigators } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { bad, ok, parse } from "@/lib/api";

export const runtime = "nodejs";

const Input = z.object({
  services: z.array(z.string().max(80)).max(10),
  contactMethod: z.enum(["phone", "email"]),
  phone: z.string().trim().max(40).regex(/^[0-9 +()-]*$/, "Use numbers only").optional().default(""),
  bestTime: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
}).refine((x) => x.contactMethod !== "phone" || x.phone.length >= 6, { message: "Please give a phone number", path: ["phone"] });

/** "Would you like Ageing Navigator to organise this?" The request is stored on the case and the navigators are told. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await caseForToken(token);
  if (!c) return bad("This link is not valid any more.", undefined, 404);
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  if (!(await hit(`request:${c.linkId}`, 5, 86_400))) return bad("We already have your requests. A navigator will be in touch.", undefined, 429);
  const known = new Set(c.releasedPlan.services.map((s) => s.id));
  const services = parsed.data.services.filter((s) => known.has(s));
  await addRequest(c.id, { ...parsed.data, services });
  await notifyNavigators(`Implementation request ${c.reference}`, [`A family has asked Ageing Navigator for help with their plan. Reference ${c.reference}.`], c.id);
  return ok({ ok: true }, 201);
}
