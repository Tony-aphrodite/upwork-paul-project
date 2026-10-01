import { test, type Condition } from "../rules/condition";
import { list } from "../text";
import { priorityRank } from "../priority";
import type { Answers, QuestionDefinition } from "../questionnaire/schema";
import { questionIndex } from "../questionnaire/logic";
import type { PilotContent } from "./content";
import type { PilotPlan } from "./plan";

/**
 * Answers in, a pilot Action Plan out. Pure: no I/O, no clock unless given, no AI. Every sentence comes from the
 * approved content; the family's answers only decide which rows apply and fill placeholders.
 *
 * Two kinds of wording:
 * - rows (situation, what matters, actions, information) may use {{name}} and {{answer.QUESTION_ID}} for a choice
 *   question. A row whose answer placeholder has nothing specific to say is left out, so a plan never prints
 *   "You mentioned ." and never places a family's own typing inside a sentence;
 * - fixed texts (introduction, pathway explanations, invitation) may use {{name}} only, which is always filled.
 *   The content compiler enforces both rules.
 */

export type Person = { firstName: string; preferredName?: string; contactName: string };

/** "mary" becomes "Mary"; a name typed with capitals is kept as typed. */
export function tidyName(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t === t.toLowerCase() ? t.replace(/(^|[\s'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : t;
}

/** Answers that say nothing specific, left out of sentences: "Other", "None", "Not sure" and the standard unsure answers. */
const NOT_SPECIFIC = new Set(["other", "something_else", "none", "not_sure", "unsure", "dont_know", "not_applicable"]);

/**
 * A label inside a sentence. Its first letter is lower-cased ("Falls" → "falls") unless the label is a name or an
 * acronym: it starts with capitals ("GP") or has another capitalised word ("Te Whatu Ora", "Live Stronger for Longer").
 */
function inSentence(label: string): string {
  const words = label.split(/\s+/);
  if (/^[A-Z]{2,}/.test(words[0]) || words.slice(1).some((w) => /^[A-Z]/.test(w))) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function answerPhrase(q: QuestionDefinition | undefined, value: unknown): string {
  if (!q || (q.type !== "single" && q.type !== "multi")) return "";
  const chosen = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const labels = chosen
    .map((v) => q.options.find((o) => o.value === v))
    .filter((o): o is NonNullable<typeof o> => !!o && !o.exclusive && !NOT_SPECIFIC.has(o.value))
    .map((o) => inSentence(o.label));
  return list(labels);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generatePilotPlan(content: PilotContent, answers: Answers, person: Person, opts: { now?: Date } = {}): PilotPlan {
  const qs = questionIndex(content.questionnaire);
  const name = tidyName(person.preferredName || person.firstName);
  const applies = (c: Condition | undefined) => test(c, answers);

  /** Row wording: undefined when an answer placeholder has nothing specific, so the row is dropped. */
  const fillRow = (s: string): string | undefined => {
    let empty = false;
    const out = s.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, p: string) => {
      const v = p === "name" ? name : p.startsWith("answer.") ? answerPhrase(qs.get(p.slice(7)), answers[p.slice(7)]) : "";
      if (!v) empty = true;
      return v;
    });
    return empty ? undefined : capitalise(out.trim());
  };
  const fillRows = (xs: string[]) => xs.map(fillRow).filter((x): x is string => !!x);
  /** Fixed texts: {{name}} only, always filled. */
  const fillText = (s: string) => capitalise(s.replace(/\{\{\s*name\s*\}\}/g, name).trim());

  const urgentOn = content.settings.urgentWhen ? applies(content.settings.urgentWhen) : false;
  const urgentQ = content.settings.urgentItemsQuestion;
  const urgentItems = urgentOn && urgentQ
    ? (qs.get(urgentQ)?.options ?? []).filter((o) => (answers[urgentQ] as string[] | undefined)?.includes(o.value)).map((o) => o.label)
    : [];

  // Several rows may describe one pathway under different conditions; the first that applies is used.
  const seen = new Set<string>();
  const pathways = content.pathways
    .filter((p) => applies(p.when) && !seen.has(p.id) && !!seen.add(p.id))
    .map((p) => ({ id: p.id, name: p.name, explanation: fillText(p.explanation), removed: false }));

  const actions = content.actions
    .map((a, order) => ({ a, order }))
    .filter(({ a }) => applies(a.when))
    .flatMap(({ a, order }) => {
      const title = fillRow(a.title);
      if (!title) return [];
      return [{
        order,
        action: {
          key: a.key, topic: a.topic, priority: a.priority, title,
          why: fillRow(a.why) ?? "", nextStep: fillRow(a.nextStep) ?? "",
          whoCanHelp: fillRows(a.whoCanHelp), prepare: fillRows(a.prepare), questions: fillRows(a.questions), check: fillRows(a.check),
          ...(a.sourceId ? { sourceId: a.sourceId } : {}),
          removed: false,
        },
      }];
    })
    .sort((x, y) => priorityRank(x.action.priority) - priorityRank(y.action.priority) || x.order - y.order)
    .map((x) => x.action);

  const information = content.information.flatMap((x) => {
    if (!applies(x.when)) return [];
    const text = fillRow(x.text);
    if (!text) return [];
    return [{ id: x.id, section: x.section, title: fillRow(x.title) ?? "", text, ...(x.sourceId ? { sourceId: x.sourceId } : {}), removed: false }];
  });

  const first = pathways[0]?.id;
  const cta = (first && content.texts[`cta_${first}`]) || content.texts.cta_default;
  const onPath = new Set(pathways.map((p) => p.id));
  const cited = new Set([...actions, ...information].map((x) => x.sourceId).filter(Boolean));

  return {
    schema: "pilot-plan/1",
    generatedAt: (opts.now ?? new Date()).toISOString(),
    contentVersion: content.version,
    contentStatus: content.status,
    questionnaireVersion: content.questionnaire.version,
    personName: name,
    preparedFor: tidyName(person.contactName),
    intro: fillText(content.texts.plan_intro),
    ...(urgentOn ? { urgent: { items: urgentItems, guidance: content.texts.urgent_guidance } } : {}),
    situation: fillRows(content.summary.filter((s) => s.section === "situation" && applies(s.when)).map((s) => s.text)),
    matters: fillRows(content.summary.filter((s) => s.section === "matters" && applies(s.when)).map((s) => s.text)),
    pathways,
    pathwayNote: content.texts.pathway_none,
    actions,
    information,
    cta: fillText(cta),
    services: content.services.map((s) => ({ id: s.id, label: s.label, suggested: !!s.pathway && onPath.has(s.pathway) })),
    sources: content.sources.filter((s) => cited.has(s.id)),
    disclaimer: content.texts.disclaimer,
  };
}
