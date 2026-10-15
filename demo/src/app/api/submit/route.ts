import { z } from "zod";
import { Answers } from "@/lib/questionnaire/schema";
import { checkAll, cleanAnswers, pruneAnswers } from "@/lib/questionnaire/logic";
import { careHomes, content, contentBlocked } from "@/lib/pilot/library";
import { config } from "@/lib/config";
import { generatePilotPlan } from "@/lib/pilot/engine";
import { createCase, logEvent, release } from "@/lib/cases";
import { emailFamilyLink, familyLink } from "@/lib/release";
import { db } from "@/lib/db";
import { notifyNavigators } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { clientIp, hashToken, newToken, pseudonym } from "@/lib/secrets";
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
 * The family submits their answers. The case is stored with its generated plan, which is released at once (the client
 * decided on 2026-10-13 that plans need no review before they are sent): the family gets a private link on the
 * thank-you page and by email. Navigators are told by email, with the reference only, and can still open the plan,
 * change it and release it again. Urgent answers bring the urgent guidance first and an "URGENT" email.
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
  const plan = generatePilotPlan(content, answers, person, { careHomes });
  const urgent = !!plan.urgent;
  const { id, reference, created } = await createCase({
    submissionId: input.submissionId, answers, contact: input.contact, person, consentAt: new Date(), marketingConsent: input.marketingConsent,
    referral: cleanReferral(input.referral), urgent, pathways: plan.pathways.map((p) => p.id), plan,
    questionnaireVersion: content.questionnaire.version, contentVersion: content.version,
  });
  // A retried submission finds its case but no link: the link exists only once, in the first response and the email.
  let link: string | undefined;
  if (created) {
    const token = newToken();
    const { retainUntil } = await release(id, 1, hashToken(token), null);
    await emailFamilyLink({ id, contactEmail: input.contact.email }, token, retainUntil);
    link = familyLink(token);
    log("case.submitted", { reference, urgent });
    await notifyNavigators(
      urgent ? `URGENT: new plan sent ${reference}` : `New plan sent ${reference}`,
      [urgent
        ? `A family has completed the questionnaire and reported something that may need urgent attention. Their plan has been sent to them. Reference ${reference}.`
        : `A family has completed the questionnaire, and their plan has been sent to them. Reference ${reference}.`,
        "You can open the case to read the plan, change anything and send an updated version."],
      id,
    );
  }
  return ok({ reference, urgent, ...(link ? { link } : {}), ...(urgent ? { urgentGuidance: content.texts.urgent_guidance } : {}) }, 201);
});
