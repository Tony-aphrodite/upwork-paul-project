import { test } from "../engine/conditions";
import { list } from "../engine/context";
import { PRIORITIES, type Condition } from "../schema";
import type { Answers, QuestionDefinition } from "../questionnaire/schema";
import { questionIndex } from "../questionnaire/logic";
import type { PilotContent } from "./content";
import type { PilotPlan } from "./plan";

/**
 * Answers in, a pilot Action Plan out. Pure: no I/O, no clock unless given, no AI. Every sentence comes from the
 * approved content; the family's answers only decide which rows apply and fill the two kinds of placeholder,
 * {{name}} and {{answer.QUESTION_ID}} for choice questions. A row whose placeholder has nothing to fill is left out,
 * so a plan never prints "You mentioned ." or a family's own typing inside a sentence.
 */

export type Person = { firstName: string; preferredName?: string; contactName: string };

/** "mary" becomes "Mary"; a name typed with capitals is kept as typed. */
export function tidyName(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t === t.toLowerCase() ? t.replace(/(^|[\s'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : t;
}

const UNSPECIFIC = /^(other|something_else|none|not_sure|unsure|dont_know|not_applicable|i_m_not_sure)/;

/** Option labels for use inside a sentence: specific answers only, first letter lower-cased unless it is an acronym. */
function answerPhrase(q: QuestionDefinition | undefined, value: unknown): string {
  if (!q || (q.type !== "single" && q.type !== "multi")) return "";
  const chosen = (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter((v) => !UNSPECIFIC.test(v));
  const labels = chosen.map((v) => q.options.find((o) => o.value === v && !o.exclusive)?.label).filter((l): l is string => !!l);
  return list(labels.map((l) => (/^[A-Z]{2,}\b/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1))));
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generatePilotPlan(content: PilotContent, answers: Answers, person: Person, opts: { now?: Date } = {}): PilotPlan {
  const qs = questionIndex(content.questionnaire);
  const name = tidyName(person.preferredName || person.firstName);
  const applies = (c: Condition | undefined) => test(c, answers);

  /** Fill placeholders; undefined when one of them is empty, so the row is dropped. */
  const fill = (s: string): string | undefined => {
    let empty = false;
    const out = s.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, p: string) => {
      const v = p === "name" ? name : p.startsWith("answer.") ? answerPhrase(qs.get(p.slice(7)), answers[p.slice(7)]) : "";
      if (!v) empty = true;
      return v;
    });
    return empty ? undefined : capitalise(out.trim());
  };
  const fillAll = (xs: string[]) => xs.map(fill).filter((x): x is string => !!x);

  const urgentOn = content.settings.urgentWhen ? applies(content.settings.urgentWhen) : false;
  const urgentQ = content.settings.urgentItemsQuestion;
  const urgentItems = urgentOn && urgentQ ? (qs.get(urgentQ)?.options ?? []).filter((o) => (answers[urgentQ] as string[] | undefined)?.includes(o.value)).map((o) => o.label) : [];

  const seenPathways = new Set<string>();
  const pathways = content.pathways.filter((p) => applies(p.when) && !seenPathways.has(p.id) && seenPathways.add(p.id))
    .map((p) => ({ id: p.id, name: p.name, explanation: fill(p.explanation) ?? p.explanation.replace(/\{\{[^}]*\}\}/g, "").trim() }));

  const rank = (p: (typeof PRIORITIES)[number]) => PRIORITIES.indexOf(p);
  const actions = content.actions
    .map((a, order) => ({ a, order }))
    .filter(({ a }) => applies(a.when))
    .map(({ a, order }) => {
      const title = fill(a.title);
      if (!title) return undefined;
      return {
        order,
        action: {
          key: a.key, topic: a.topic, priority: a.priority, title,
          why: fill(a.why) ?? "", nextStep: fill(a.nextStep) ?? "",
          whoCanHelp: fillAll(a.whoCanHelp), prepare: fillAll(a.prepare), questions: fillAll(a.questions), check: fillAll(a.check),
          ...(a.sourceId ? { sourceId: a.sourceId } : {}),
          removed: false,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((x, y) => rank(x.action.priority) - rank(y.action.priority) || x.order - y.order)
    .map((x) => x.action);

  const information = content.information.flatMap((x, n) => {
    if (!applies(x.when)) return [];
    const text = fill(x.text);
    if (!text) return [];
    return [{ id: `info-${n + 1}`, section: x.section, title: fill(x.title) ?? "", text, ...(x.sourceId ? { sourceId: x.sourceId } : {}), removed: false }];
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
    intro: fill(content.texts.plan_intro) ?? content.texts.plan_intro,
    ...(urgentOn ? { urgent: { items: urgentItems, guidance: content.texts.urgent_guidance } } : {}),
    situation: fillAll(content.summary.filter((s) => s.section === "situation" && applies(s.when)).map((s) => s.text)),
    matters: fillAll(content.summary.filter((s) => s.section === "matters" && applies(s.when)).map((s) => s.text)),
    pathways,
    pathwayNote: content.texts.pathway_none,
    actions,
    information,
    cta: fill(cta) ?? cta,
    services: content.services.map((s) => ({ id: s.id, label: s.label, suggested: !!s.pathway && onPath.has(s.pathway) })),
    sources: content.sources.filter((s) => cited.has(s.id)),
    disclaimer: content.texts.disclaimer,
  };
}
