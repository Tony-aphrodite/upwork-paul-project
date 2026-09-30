import { z } from "zod";
import { addRequest } from "@/lib/cases";
import { notifyNavigators } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { bad, ok, parse } from "@/lib/api";
import { familyRoute } from "@/lib/route";
import { LIMITS, isPhone } from "@/lib/validate";

export const runtime = "nodejs";

const Input = z.object({
  services: z.array(z.string().max(80)).max(10),
  contactMethod: z.enum(["phone", "email"]),
  phone: z.string().trim().max(LIMITS.phone).optional().default(""),
  bestTime: z.string().trim().max(LIMITS.bestTime).optional().default(""),
  message: z.string().trim().max(LIMITS.message).optional().default(""),
}).refine((x) => x.contactMethod !== "phone" || isPhone(x.phone), { message: "Please give a phone number with at least six digits", path: ["phone"] });

/** "Would you like Ageing Navigator to organise this?" The request is stored on the case and the navigators are told. */
export const POST = familyRoute(async (req, c) => {
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  if (!(await hit(`request:${c.linkId}`, 5, 86_400))) return bad("We already have several requests from you today. A navigator will be in touch.", undefined, 429);
  const known = new Set(c.releasedPlan.services.map((s) => s.id));
  const { contactMethod, phone, bestTime, message } = parsed.data;
  await addRequest(c.id, { services: parsed.data.services.filter((s) => known.has(s)), contactMethod, phone: contactMethod === "phone" ? phone : null, bestTime, message });
  await notifyNavigators(`Implementation request ${c.reference}`, [`A family has asked Ageing Navigator for help with their plan. Reference ${c.reference}.`], c.id);
  return ok({ ok: true }, 201);
});
