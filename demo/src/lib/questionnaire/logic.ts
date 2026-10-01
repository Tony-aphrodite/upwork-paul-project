import { test } from "../rules/condition";
import { EMAIL_RE, LIMITS } from "../validate";
import type { Answers, QuestionDefinition, Questionnaire, QuestionnaireSection } from "./schema";

/**
 * "You will only be shown questions that are relevant to you."
 * The same declarative condition evaluator the plan modules use, read over the answers instead of the profile.
 */

export type VisibleSection = QuestionnaireSection & { questions: QuestionDefinition[] };

export const isAnswered = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : typeof v === "object" && v !== null ? Object.values(v).some((x) => x !== undefined && x !== "") : typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null;

export function visibleQuestions(section: QuestionnaireSection, answers: Answers): QuestionDefinition[] {
  return section.questions.filter((q) => test(q.when, answers));
}

/** Sections whose condition is met, each carrying only the questions that apply. Order follows the file. */
export function visibleSections(doc: Questionnaire, answers: Answers): VisibleSection[] {
  return doc.sections
    .filter((s) => test(s.when, answers))
    .map((s) => ({ ...s, questions: visibleQuestions(s, answers) }))
    .filter((s) => s.questions.length > 0);
}

export type Issue = { questionId: string; message: string };

/** Validation a family sees while answering: required questions, "choose up to three", and an email that looks like one. */
export function checkSection(section: VisibleSection, answers: Answers): Issue[] {
  const issues: Issue[] = [];
  for (const q of section.questions) {
    const v = answers[q.id];
    if (!q.optional && !isAnswered(v)) { issues.push({ questionId: q.id, message: offersNotSure(q) ? "Please answer this question, or choose Not sure." : "Please answer this question." }); continue; }
    if (!isAnswered(v)) continue;
    if (q.type === "multi" && q.max && Array.isArray(v) && v.length > q.max) issues.push({ questionId: q.id, message: `Please choose up to ${q.max}.` });
    if (q.type === "tri_grid" && !q.optional) {
      const rows = (v ?? {}) as Record<string, string>;
      if (q.items.some((i) => !rows[i.id])) issues.push({ questionId: q.id, message: "Please answer every row, or choose Not sure." });
    }
    if (q.format === "email" && typeof v === "string" && !EMAIL_RE.test(v.trim())) issues.push({ questionId: q.id, message: "Please check this email address." });
  }
  return issues;
}

/** Every visible question that still needs an answer, used before the questionnaire is submitted. */
export function checkAll(doc: Questionnaire, answers: Answers): Issue[] {
  return visibleSections(doc, answers).flatMap((s) => checkSection(s, answers));
}

export function progress(doc: Questionnaire, answers: Answers): { answered: number; total: number; percent: number } {
  const questions = visibleSections(doc, answers).flatMap((s) => s.questions).filter((q) => !q.optional);
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  return { answered, total: questions.length, percent: questions.length ? Math.round((answered / questions.length) * 100) : 0 };
}

/**
 * Drop answers to questions that are no longer shown, so a changed answer cannot leave a hidden section behind.
 * Repeated until nothing changes: removing one answer can hide a question that depended on it.
 */
export function pruneAnswers(doc: Questionnaire, answers: Answers): Answers {
  let current = answers;
  for (;;) {
    const visible = new Set(visibleSections(doc, current).flatMap((s) => s.questions.map((q) => q.id)));
    const next = Object.fromEntries(Object.entries(current).filter(([k]) => visible.has(k)));
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
}

/** Whether a question lets people say they do not know: a standard unsure answer, or an option worded that way. */
const NOT_SURE_VALUES = new Set(["unsure", "not_sure", "dont_know"]);
const NOT_SURE_LABEL = /^(i['’]?m )?(not sure|unsure|don['’]?t know)/i;
export const offersNotSure = (q: QuestionDefinition) => q.options.some((o) => NOT_SURE_VALUES.has(o.value) || NOT_SURE_LABEL.test(o.label));

export const questionIndex = (doc: Questionnaire): Map<string, QuestionDefinition> =>
  new Map(doc.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));

/** Option labels for an answer, used by the review page and by the mapping when free text is kept. */
export function labelsFor(q: QuestionDefinition, value: unknown): string[] {
  const byValue = new Map(q.options.map((o) => [o.value, o.label]));
  if (Array.isArray(value)) return value.map((v) => byValue.get(v) ?? v);
  if (typeof value === "string") return [byValue.get(value) ?? value];
  if (value && typeof value === "object") return q.items.map((i) => `${i.label}: ${byValue.get((value as Record<string, string>)[i.id]) ?? "Not answered"}`);
  return [];
}

export const TEXT_LIMIT = { short: LIMITS.shortAnswer, long: LIMITS.longAnswer } as const;

/**
 * Server-side clean-up of submitted answers: unknown questions, options that do not exist, wrong types and
 * over-long text are dropped. When a multiple-choice answer mixes an exclusive option ("None of these") with others,
 * the specific answers are kept. Visibility and required answers are checked afterwards by `pruneAnswers` and `checkAll`.
 */
export function cleanAnswers(doc: Questionnaire, raw: Record<string, unknown>): Answers {
  const qs = questionIndex(doc);
  const out: Answers = {};
  for (const [id, v] of Object.entries(raw)) {
    const q = qs.get(id);
    if (!q) continue;
    const allowed = new Map(q.options.map((o) => [o.value, o]));
    if (q.type === "single" && typeof v === "string" && allowed.has(v)) out[id] = v;
    else if (q.type === "multi" && Array.isArray(v)) {
      let vs = [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))];
      const specific = vs.filter((x) => !allowed.get(x)!.exclusive);
      if (specific.length) vs = specific;
      else if (vs.length > 1) vs = vs.slice(-1);
      if (vs.length) out[id] = vs;
    } else if ((q.type === "short" || q.type === "long") && typeof v === "string") {
      const t = v.trim().slice(0, TEXT_LIMIT[q.type]);
      if (t) out[id] = t;
    } else if (q.type === "tri_grid" && v && typeof v === "object" && !Array.isArray(v)) {
      const rows: Record<string, string> = {};
      for (const item of q.items) {
        const x = (v as Record<string, unknown>)[item.id];
        if (typeof x === "string" && allowed.has(x)) rows[item.id] = x;
      }
      if (Object.keys(rows).length) out[id] = rows;
    }
  }
  return out;
}
