import { test } from "../engine/conditions";
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
    if (!q.optional && !isAnswered(v)) { issues.push({ questionId: q.id, message: "Please answer this question, or choose Not sure." }); continue; }
    if (!isAnswered(v)) continue;
    if (q.type === "multi" && q.max && Array.isArray(v) && v.length > q.max) issues.push({ questionId: q.id, message: `Please choose up to ${q.max}.` });
    if (q.type === "tri_grid" && !q.optional) {
      const rows = (v ?? {}) as Record<string, string>;
      if (q.items.some((i) => !rows[i.id])) issues.push({ questionId: q.id, message: "Please answer every row, or choose Not sure." });
    }
    if (q.format === "email" && typeof v === "string" && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v.trim())) issues.push({ questionId: q.id, message: "Please check this email address." });
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

/** Drop answers to questions that are no longer shown, so a changed answer cannot leave a hidden section behind. */
export function pruneAnswers(doc: Questionnaire, answers: Answers): Answers {
  const visible = new Set(visibleSections(doc, answers).flatMap((s) => s.questions.map((q) => q.id)));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => visible.has(k)));
}

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
