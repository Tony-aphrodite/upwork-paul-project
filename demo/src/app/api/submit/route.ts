import { z } from "zod";
import { Answers } from "@/lib/questionnaire/schema";
import { checkAll, cleanAnswers, pruneAnswers } from "@/lib/questionnaire/logic";
import { content, contentBlocked } from "@/lib/pilot/library";
import { config } from "@/lib/config";
import { generatePilotPlan } from "@/lib/pilot/engine";
import { createCase, logEvent } from "@/lib/cases";
import { db } from "@/lib/db";
import { notifyNavigators } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { clientIp, pseudonym } from "@/lib/secrets";
import { bad, ok, parse } from "@/lib/api";
import { publicRoute } from "@/lib/route";
import { log } from "@/lib/log";
import { EMAIL_RE, LIMITS, PHONE_CHARS, cleanReferral } from "@/lib/validate";

export const runtime = "nodejs";

const Input = z.object({
  /** Chosen by the browser once per questionnaire: a retried submission finds the case it already made. */
  submissionId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/).optional(),
  questionnaireVersion: z.string().max(40).optional(),
  answers: Answers,
  contact: z.object({
    name: z.string().trim().min(1, "Please tell us your name").max(LIMITS.name),
    email: z.string().trim().max(LIMITS.email).regex(EMAIL_RE, "Please check this email address"),
    phone: z.string().trim().max(LIMITS.phone).regex(PHONE_CHARS, "Use numbers only").optional().default(""),
  }),
  person: z.object({ firstName: z.string().trim().min(1, "Please give their first name").max(LIMITS.firstName), preferredName: z.string().trim().max(LIMITS.firstName).optional().default("") }),
  consent: z.literal(true, { message: "Consent is needed before we can prepare a plan" }),
  marketingConsent: z.boolean().optional().default(false),
  referral: z.string().max(200).optional(),
  /** Honeypot: people never see this field; bots fill it in. */
  an_hp: z.string().max(200).optional(),
});

/**
 * The family submits their answers. The case is stored with its generated plan, which a navigator checks before
 * anything is sent: the response carries no plan, only the reference and, when urgent answers were given, the
 * urgent guidance to show straight away. Navigators are told by email, with the reference only.
 */
export const POST = publicRoute(async (req) => {
  if (contentBlocked(config.requireApprovedContent())) return bad("The questionnaire is not open yet. Please try again soon.", undefined, 503);
  const parsed = await parse(req, Input);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;
  if (input.an_hp) {
    await logEvent(await db(), null, "system", "honeypot");
    return ok({ reference: "AN-THANKS", urgent: false }, 201);
  }

  const answers = pruneAnswers(content.questionnaire, cleanAnswers(content.questionnaire, input.answers));
  const missing = checkAll(content.questionnaire, answers);
  if (missing.length) {
    const outdated = !!input.questionnaireVersion && input.questionnaireVersion !== content.questionnaire.version;
    return bad(outdated ? "The questionnaire has been updated. Please reload the page: your answers are kept." : "Some questions still need an answer.",
      missing.map((m) => ({ path: m.questionId, message: m.message })));
  }
  // Counted only once the answers are complete, so families on a shared connection are not locked out by mistakes.
  if (!(await hit(`submit:${pseudonym(clientIp(req))}`, 10, 3600))) return bad("Too many questionnaires from this connection. Please try again in an hour.", undefined, 429);

  const person = { firstName: input.person.firstName, preferredName: input.person.preferredName || undefined, contactName: input.contact.name };
  const plan = generatePilotPlan(content, answers, person);
  const urgent = !!plan.urgent;
  const { id, reference, created } = await createCase({
    submissionId: input.submissionId, answers, contact: input.contact, person, consentAt: new Date(), marketingConsent: input.marketingConsent,
    referral: cleanReferral(input.referral), urgent, pathways: plan.pathways.map((p) => p.id), plan,
    questionnaireVersion: content.questionnaire.version, contentVersion: content.version,
  });
  if (created) {
    log("case.submitted", { reference, urgent });
    await notifyNavigators(
      urgent ? `URGENT: new questionnaire ${reference}` : `New questionnaire ${reference}`,
      [urgent ? `A family has submitted the questionnaire and reported something that may need urgent attention. Reference ${reference}.` : `A family has submitted the questionnaire. Reference ${reference}.`],
      id,
    );
  }
  return ok({ reference, urgent, ...(urgent ? { urgentGuidance: content.texts.urgent_guidance } : {}) }, 201);
});
