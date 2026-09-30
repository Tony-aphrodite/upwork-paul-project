import { z } from "zod";
import { Answers } from "@/lib/questionnaire/schema";
import { checkAll, cleanAnswers, pruneAnswers } from "@/lib/questionnaire/logic";
import { content } from "@/lib/pilot/library";
import { generatePilotPlan } from "@/lib/pilot/engine";
import { createCase } from "@/lib/cases";
import { notifyNavigators } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { clientIp, pseudonym } from "@/lib/secrets";
import { bad, ok, parse } from "@/lib/api";
import { log } from "@/lib/log";
import { EMAIL_RE, cleanReferral } from "@/lib/validate";

export const runtime = "nodejs";

const Input = z.object({
  answers: Answers,
  contact: z.object({
    name: z.string().trim().min(1, "Please tell us your name").max(120),
    email: z.string().trim().max(200).regex(EMAIL_RE, "Please check this email address"),
    phone: z.string().trim().max(40).regex(/^[0-9 +()-]*$/, "Use numbers only").optional().default(""),
  }),
  person: z.object({ firstName: z.string().trim().min(1, "Please give their first name").max(80), preferredName: z.string().trim().max(80).optional().default("") }),
  consent: z.literal(true, { message: "Consent is needed before we can prepare a plan" }),
  marketingConsent: z.boolean().optional().default(false),
  referral: z.string().max(200).optional(),
  /** Honeypot: people never see this field; bots fill it in. */
  website: z.string().max(200).optional(),
});

/**
 * The family submits their answers. The case is stored with its generated plan, which a navigator checks before
 * anything is sent: the response carries no plan, only the reference and, when urgent answers were given, the
 * urgent guidance to show straight away. Navigators are told by email, with the reference only.
 */
export async function POST(req: Request) {
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;
  if (input.website) return ok({ reference: "AN-THANKS", urgent: false }); // quietly ignore bots

  if (!(await hit(`submit:${pseudonym(clientIp(req))}`, 6, 3600))) return bad("Too many submissions from this connection. Please try again later.", undefined, 429);

  const answers = pruneAnswers(content.questionnaire, cleanAnswers(content.questionnaire, input.answers));
  const missing = checkAll(content.questionnaire, answers);
  if (missing.length) return bad("Some questions still need an answer.", missing.map((m) => ({ path: m.questionId, message: m.message })));

  const person = { firstName: input.person.firstName, preferredName: input.person.preferredName || undefined, contactName: input.contact.name };
  const plan = generatePilotPlan(content, answers, person);
  const urgent = !!plan.urgent;
  const { id, reference } = await createCase({
    answers, contact: input.contact, person, consentAt: new Date(), marketingConsent: input.marketingConsent,
    referral: cleanReferral(input.referral), urgent, pathways: plan.pathways.map((p) => p.id), plan,
    questionnaireVersion: content.questionnaire.version, contentVersion: content.version,
  });
  log("case.submitted", { reference, urgent });
  await notifyNavigators(
    urgent ? `URGENT: new questionnaire ${reference}` : `New questionnaire ${reference}`,
    [urgent ? `A family has submitted the questionnaire and reported something that may need urgent attention. Reference ${reference}.` : `A family has submitted the questionnaire. Reference ${reference}.`],
    id,
  );
  return ok({ reference, urgent, ...(urgent ? { urgentGuidance: content.texts.urgent_guidance } : {}) }, 201);
}
