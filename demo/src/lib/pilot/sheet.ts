import { z } from "zod";
import { fieldsOf, type Condition } from "../rules/condition";
import type { Priority } from "../priority";
import { Questionnaire, type QuestionDefinition } from "../questionnaire/schema";
import { KEYWORDS, parseRule, ruleToText, RuleError, type QuestionLookup } from "./rule-syntax";
import { PATHWAY_IDS, PilotContent, TEXT_KEYS, WebUrl, type PathwayId } from "./content";

/**
 * The content spreadsheet, as plain rows: one object per row, keyed by column header. `compileContent` turns the
 * rows into validated content and reports every problem with its tab, row and column; `contentToRows` does the
 * reverse, so the spreadsheet can be pre-filled from the current content. Reading and writing .xlsx files is the
 * scripts' job (`scripts/lib/xlsx.ts`); this file has no file or network access.
 *
 * A row may carry `__row`, its row number in the sheet, so messages point at the right row even when blank rows
 * were skipped while reading.
 */

export type Row = Record<string, string>;
export type Rows = Record<string, Row[]>;

export const TABS = {
  settings: { name: "Settings", columns: ["Key", "Value"] },
  sections: { name: "Sections", columns: ["ID", "Title", "Intro", "Show when"] },
  questions: { name: "Questions", columns: ["ID", "Section", "Pathway", "Type", "Question", "Help", "Options", "Exclusive options", "Unsure answers", "Required", "Max choices", "Rows", "Show when", "Notes"] },
  pathways: { name: "Pathways", columns: ["ID", "Name", "Show when", "Explanation", "Status"] },
  summary: { name: "Summary", columns: ["ID", "Section", "Show when", "Text", "Status"] },
  actions: { name: "Actions", columns: ["Key", "Topic", "Priority", "Show when", "What to do", "Why it matters", "Next step", "Who can help", "What to prepare", "Questions to ask", "Things to check", "Source", "Status"] },
  information: { name: "Information", columns: ["ID", "Section", "Show when", "Title", "Text", "Source", "Status"] },
  texts: { name: "Texts", columns: ["Key", "Text"] },
  services: { name: "Services", columns: ["ID", "Label", "Pathway"] },
  sources: { name: "Sources", columns: ["ID", "Title", "Publisher", "URL", "Last checked"] },
} as const;
type TabKey = keyof typeof TABS;

const TYPE_LABEL: Record<QuestionDefinition["type"], string> = { single: "Single choice", multi: "Multiple choice", short: "Short text", long: "Long text", tri_grid: "Grid" };
export const UNSURE_LABEL = { unsure: "Unsure", dont_know: "Don't know", not_applicable: "Not applicable" } as const;
type UnsureId = keyof typeof UNSURE_LABEL;
const PRIORITY_TEXT: Record<Priority, string> = { now: "Now", soon: "Soon", plan_ahead: "Plan ahead" };
const SUMMARY_TEXT = { situation: "A. Your current situation", matters: "B. What matters most" } as const;
const INFO_TEXT = { funding: "E. Funding and assessment", check: "G. Things to check", professional: "H. Professional assessment or advice" } as const;
const SETTING_URGENT_WHEN = "Urgent when";
const SETTING_URGENT_ITEMS = "Urgent items question";

/** Placeholders each kind of wording may use. Rows may also use {{answer.ID}} for a choice question. */
const TEXT_PLACEHOLDERS: Record<string, string[]> = {
  plan_intro: ["name"], cta_default: ["name"], cta_stay_home: ["name"], cta_village: ["name"], cta_residential: ["name"],
  email_release_body: ["link", "expires"],
};

export type Problem = { tab: string; row?: number; column?: string; message: string };
export class ContentError extends Error {
  constructor(public problems: Problem[]) { super(`${problems.length} problem${problems.length === 1 ? "" : "s"} in the content`); }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cell = (row: Row, column: string) => {
  const want = norm(column);
  for (const [k, v] of Object.entries(row)) if (k !== "__row" && norm(k) === want) return String(v ?? "").trim();
  return "";
};
const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const isBlank = (row: Row) => Object.entries(row).every(([k, v]) => k === "__row" || !String(v ?? "").trim());
const placeholdersIn = (s: string) => [...s.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]);

/** "value = Label" per line. A line with no "=" uses the label, turned into a value. */
function pairs(s: string) {
  return lines(s).map((l) => {
    const at = l.indexOf("=");
    if (at < 0) return { value: l.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label: l };
    return { value: l.slice(0, at).trim(), label: l.slice(at + 1).trim() };
  });
}

type Numbered = { r: Row; n: number };

export function compileContent(rows: Rows, opts: { version: string }): PilotContent {
  const problems: Problem[] = [];
  const add = (tab: string, row: number | undefined, column: string | undefined, message: string) => problems.push({ tab, row, column, message });
  /** The non-blank rows of a tab with their sheet row numbers (header = row 1). */
  const tab = (key: TabKey): Numbered[] =>
    (rows[TABS[key].name] ?? []).map((r, i) => ({ r, n: r.__row ? Number(r.__row) : i + 2 })).filter(({ r }) => !isBlank(r));

  /* ---------- texts first: the questionnaire's title, intro and notice live there ---------- */
  const texts: Record<string, string> = {};
  const known = new Set<string>([...TEXT_KEYS.required, ...TEXT_KEYS.optional]);
  for (const { r, n } of tab("texts")) {
    const key = cell(r, "Key");
    if (!key) { add("Texts", n, "Key", "A text has no key."); continue; }
    if (!known.has(key)) add("Texts", n, "Key", `"${key}" is not a text the app uses. Known keys: ${[...known].join(", ")}.`);
    if (texts[key] !== undefined) add("Texts", n, "Key", `"${key}" appears twice.`);
    texts[key] = cell(r, "Text");
    const allowed = TEXT_PLACEHOLDERS[key] ?? [];
    for (const p of placeholdersIn(texts[key])) {
      if (!allowed.includes(p)) add("Texts", n, "Text", allowed.length ? `{{${p}}} cannot be used here. This text may use ${allowed.map((a) => `{{${a}}}`).join(" and ")}.` : `{{${p}}}: this text cannot contain placeholders.`);
    }
  }
  for (const k of TEXT_KEYS.required) if (!texts[k]?.trim()) add("Texts", undefined, "Text", `"${k}" is required.`);

  /* ---------- sections and questions ---------- */
  const sections = tab("sections").map(({ r, n }) => ({ n, id: cell(r, "ID"), title: cell(r, "Title"), intro: cell(r, "Intro"), whenText: cell(r, "Show when") }));
  const sectionIds = new Set(sections.map((s) => s.id));
  for (const s of sections) if (!/^[a-z0-9_]+$/.test(s.id)) add("Sections", s.n, "ID", `"${s.id}" is not a valid ID: use lower-case letters, numbers and underscores.`);

  const typeByLabel = new Map<string, QuestionDefinition["type"]>(Object.entries(TYPE_LABEL).map(([k, v]) => [norm(v), k as QuestionDefinition["type"]]));
  for (const k of Object.keys(TYPE_LABEL)) typeByLabel.set(norm(k), k as QuestionDefinition["type"]);
  const unsureByLabel = new Map<string, UnsureId>(Object.entries(UNSURE_LABEL).map(([k, v]) => [norm(v), k as UnsureId]));

  type Draft = { n: number; section: string; whenText: string; q: Record<string, unknown> };
  const drafts: Draft[] = tab("questions").map(({ r, n }) => {
    const id = cell(r, "ID");
    const type = typeByLabel.get(norm(cell(r, "Type")));
    const section = cell(r, "Section");
    if (!/^[a-z0-9_]+$/.test(id) || KEYWORDS.has(id)) add("Questions", n, "ID", `"${id}" is not a valid ID: use lower-case letters, numbers and underscores, and not a word such as "and" or "in".`);
    if (!type) add("Questions", n, "Type", `"${cell(r, "Type")}" is not a type. Use: ${Object.values(TYPE_LABEL).join(", ")}.`);
    if (!sectionIds.has(section)) add("Questions", n, "Section", `"${section}" is not in the Sections tab.`);
    const unsure = list(cell(r, "Unsure answers")).map((l) => {
      const u = unsureByLabel.get(norm(l));
      if (!u) add("Questions", n, "Unsure answers", `"${l}" is not one of: ${Object.values(UNSURE_LABEL).join(", ")}.`);
      return u;
    }).filter((u): u is UnsureId => !!u);
    const declared = pairs(cell(r, "Options"));
    for (const o of declared) {
      if (!/^[a-z0-9_]+$/.test(o.value)) add("Questions", n, "Options", `"${o.value}" is not a valid option value: use lower-case letters, numbers and underscores before the "=".`);
      else if (KEYWORDS.has(o.value)) add("Questions", n, "Options", `"${o.value}" cannot be an option value, because conditions use that word. Choose another value.`);
      if ((unsure as string[]).includes(o.value)) add("Questions", n, "Options", `"${o.value}" is also in Unsure answers: keep it in one place.`);
    }
    const exclusive = new Set(list(cell(r, "Exclusive options")));
    for (const v of exclusive) if (!declared.some((o) => o.value === v)) add("Questions", n, "Exclusive options", `"${v}" is not one of this question's options.`);
    if (exclusive.size && type !== "multi") add("Questions", n, "Exclusive options", "Only multiple-choice questions have exclusive options.");
    if (unsure.length && type !== "single" && type !== "multi") add("Questions", n, "Unsure answers", "Unsure answers apply to single and multiple choice questions.");
    const options = [
      ...declared.map((o) => ({ ...o, ...(exclusive.has(o.value) ? { exclusive: true } : {}) })),
      ...unsure.map((u) => ({ value: u, label: UNSURE_LABEL[u], ...(type === "multi" ? { exclusive: true } : {}) })),
    ];
    const required = norm(cell(r, "Required") || "yes");
    if (!["yes", "no"].includes(required)) add("Questions", n, "Required", 'Write "yes" or "no".');
    const maxText = cell(r, "Max choices");
    const max = maxText ? Number(maxText) : undefined;
    if (maxText && (!Number.isInteger(max) || max! < 1)) add("Questions", n, "Max choices", "Write a whole number, or leave it empty.");
    const pathway = cell(r, "Pathway");
    const notes = cell(r, "Notes");
    return {
      n, section, whenText: cell(r, "Show when"),
      q: {
        id, type, label: cell(r, "Question"), help: cell(r, "Help") || undefined, optional: required === "no",
        options, unsure, items: pairs(cell(r, "Rows")).map((p) => ({ id: p.value, label: p.label })),
        ...(max !== undefined && Number.isInteger(max) ? { max } : {}),
        ...(pathway ? { pathway } : {}),
        ...(notes ? { notes } : {}),
      },
    };
  });

  // A lookup for rules: the questions as they will be, before conditions are attached.
  const lookup: QuestionLookup = new Map();
  const shape = z.object({ id: z.string(), type: z.string(), options: z.array(z.object({ value: z.string(), label: z.string() })), items: z.array(z.object({ id: z.string(), label: z.string() })) });
  for (const d of drafts) if (shape.safeParse(d.q).success) lookup.set(String(d.q.id), d.q as unknown as QuestionDefinition);

  // The order families are asked in: section by section (Sections tab), then question by question.
  const asked = sections.flatMap((s) => drafts.filter((d) => d.section === s.id));
  const order = new Map(asked.map((d, i) => [String(d.q.id), i]));

  const rule = (tabName: string, n: number | undefined, text: string, before?: number): Condition | undefined => {
    if (!text) return undefined;
    try {
      const c = parseRule(text, lookup);
      if (before !== undefined) {
        for (const f of fieldsOf(c)) {
          const id = f.split(".")[0];
          const at = order.get(id);
          if (at !== undefined && at >= before) add(tabName, n, "Show when", `${id} is asked at the same point or later, so it cannot decide whether this is shown.`);
        }
      }
      return c;
    } catch (e) {
      add(tabName, n, "Show when", e instanceof RuleError ? e.message : String(e));
      return undefined;
    }
  };

  const questionnaireSections = sections.map((s) => {
    const mine = drafts.filter((d) => d.section === s.id);
    const when = rule("Sections", s.n, s.whenText, mine.length ? order.get(String(mine[0].q.id)) : undefined);
    const questions = mine.map((d) => {
      const qWhen = rule("Questions", d.n, d.whenText, order.get(String(d.q.id)));
      return { ...d.q, ...(qWhen ? { when: qWhen } : {}) };
    });
    if (!questions.length) add("Sections", s.n, "ID", `Section "${s.id}" has no questions.`);
    return { id: s.id, title: s.title, ...(s.intro ? { intro: s.intro } : {}), conditional: !!when, ...(when ? { when } : {}), questions };
  });

  const qDoc = Questionnaire.safeParse({
    id: "ageing-navigator",
    version: opts.version,
    title: texts.questionnaire_title || "Family Ageing Questionnaire",
    intro: (texts.questionnaire_intro ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    notice: texts.notice ?? "",
    sections: questionnaireSections,
  });
  if (!qDoc.success) for (const issue of qDoc.error.issues) add("Questions", undefined, issue.path.join("."), issue.message);

  /* ---------- wording checks ---------- */
  /** Rows: {{name}}, and {{answer.ID}} for a choice question. Fixed texts (pathway explanations): {{name}} only. */
  const checkRowText = (tabName: string, n: number, column: string, text: string, nameOnly = false) => {
    for (const p of placeholdersIn(text)) {
      if (p === "name") continue;
      const a = /^answer\.([a-z0-9_]+)$/.exec(p);
      const type = a ? lookup.get(a[1])?.type : undefined;
      if (!nameOnly && (type === "single" || type === "multi")) continue;
      add(tabName, n, column, nameOnly ? `{{${p}}}: only {{name}} can be used here.`
        : a && type ? `{{${p}}}: only choice questions can be placed in wording, so a family's own typing never appears inside a sentence.`
        : `{{${p}}} is not a placeholder. Use {{name}} or {{answer.QUESTION_ID}} for a choice question.`);
    }
    return text;
  };
  const approved = (tabName: string, n: number, r: Row) => {
    const s = norm(cell(r, "Status") || "draft");
    if (s !== "approved" && s !== "draft") add(tabName, n, "Status", 'Write "Approved" or "Draft".');
    return s === "approved";
  };
  /** Row IDs: kept when given; otherwise numbered after the highest one in use, so exported IDs stay stable. */
  const ids = (prefix: string, given: string[]) => {
    let next = Math.max(0, ...given.map((g) => Number(new RegExp(`^${prefix}-(\\d+)$`).exec(g)?.[1] ?? 0))) + 1;
    return given.map((g) => g || `${prefix}-${next++}`);
  };

  /* ---------- settings ---------- */
  const settings: Record<string, unknown> = { urgentWhenText: "" };
  for (const { r, n } of tab("settings")) {
    const key = norm(cell(r, "Key"));
    const value = cell(r, "Value");
    if (key === norm(SETTING_URGENT_WHEN)) { settings.urgentWhenText = value; settings.urgentWhen = rule("Settings", n, value); }
    else if (key === norm(SETTING_URGENT_ITEMS)) {
      if (value && lookup.get(value)?.type !== "multi") add("Settings", n, "Value", `"${value}" is not a multiple-choice question.`);
      if (value) settings.urgentItemsQuestion = value;
    } else add("Settings", n, "Key", `"${cell(r, "Key")}" is not a setting. Settings: ${SETTING_URGENT_WHEN}, ${SETTING_URGENT_ITEMS}.`);
  }

  /* ---------- pathways, summary, actions, information ---------- */
  const rowNumbers: Partial<Record<"pathways" | "summary" | "actions" | "information" | "services" | "sources", number[]>> = {};

  const pathwayRows = tab("pathways");
  rowNumbers.pathways = pathwayRows.map((x) => x.n);
  const pathways = pathwayRows.map(({ r, n }) => {
    const id = cell(r, "ID") as PathwayId;
    if (!(PATHWAY_IDS as readonly string[]).includes(id)) add("Pathways", n, "ID", `"${id}" is not a pathway. Use: ${PATHWAY_IDS.join(", ")}.`);
    const whenText = cell(r, "Show when");
    return { id, name: cell(r, "Name"), explanation: checkRowText("Pathways", n, "Explanation", cell(r, "Explanation"), true), approved: approved("Pathways", n, r), whenText, when: rule("Pathways", n, whenText) };
  });

  const summaryRows = tab("summary");
  rowNumbers.summary = summaryRows.map((x) => x.n);
  const summaryIds = ids("summary", summaryRows.map(({ r }) => cell(r, "ID")));
  const summary = summaryRows.map(({ r, n }, i) => {
    const s = norm(cell(r, "Section"));
    const section = s.startsWith("a") || s.includes("situation") ? "situation" : s.startsWith("b") || s.includes("matters") ? "matters" : undefined;
    if (!section) add("Summary", n, "Section", `Write "${SUMMARY_TEXT.situation}" or "${SUMMARY_TEXT.matters}".`);
    const whenText = cell(r, "Show when");
    return { id: summaryIds[i], section, text: checkRowText("Summary", n, "Text", cell(r, "Text")), approved: approved("Summary", n, r), whenText, when: rule("Summary", n, whenText) };
  });

  const priorityByText = new Map<string, Priority>(Object.entries(PRIORITY_TEXT).map(([k, v]) => [norm(v), k as Priority]));
  const actionRows = tab("actions");
  rowNumbers.actions = actionRows.map((x) => x.n);
  const actions = actionRows.map(({ r, n }) => {
    const priority = priorityByText.get(norm(cell(r, "Priority")));
    if (!priority) add("Actions", n, "Priority", `Write ${Object.values(PRIORITY_TEXT).join(", ")}.`);
    const whenText = cell(r, "Show when");
    const text = (column: string) => checkRowText("Actions", n, column, cell(r, column));
    return {
      key: cell(r, "Key"), topic: cell(r, "Topic"), priority,
      title: text("What to do"), why: text("Why it matters"), nextStep: text("Next step"),
      whoCanHelp: lines(text("Who can help")), prepare: lines(text("What to prepare")), questions: lines(text("Questions to ask")), check: lines(text("Things to check")),
      ...(cell(r, "Source") ? { sourceId: cell(r, "Source") } : {}),
      approved: approved("Actions", n, r), whenText, when: rule("Actions", n, whenText),
    };
  });

  const infoRows = tab("information");
  rowNumbers.information = infoRows.map((x) => x.n);
  const infoIds = ids("info", infoRows.map(({ r }) => cell(r, "ID")));
  const information = infoRows.map(({ r, n }, i) => {
    const s = norm(cell(r, "Section"));
    const section = s.startsWith("e") || s.includes("funding") ? "funding" : s.startsWith("g") || s.includes("check") ? "check" : s.startsWith("h") || s.includes("professional") ? "professional" : undefined;
    if (!section) add("Information", n, "Section", `Write one of: ${Object.values(INFO_TEXT).join("; ")}.`);
    const whenText = cell(r, "Show when");
    return {
      id: infoIds[i], section, title: checkRowText("Information", n, "Title", cell(r, "Title")), text: checkRowText("Information", n, "Text", cell(r, "Text")),
      ...(cell(r, "Source") ? { sourceId: cell(r, "Source") } : {}),
      approved: approved("Information", n, r), whenText, when: rule("Information", n, whenText),
    };
  });

  const serviceRows = tab("services");
  rowNumbers.services = serviceRows.map((x) => x.n);
  const services = serviceRows.map(({ r, n }) => {
    const pathway = cell(r, "Pathway");
    if (pathway && !(PATHWAY_IDS as readonly string[]).includes(pathway)) add("Services", n, "Pathway", `"${pathway}" is not a pathway. Use: ${PATHWAY_IDS.join(", ")}, or leave it empty.`);
    return { id: cell(r, "ID"), label: cell(r, "Label"), ...(pathway ? { pathway } : {}) };
  });

  const sourceRows = tab("sources");
  rowNumbers.sources = sourceRows.map((x) => x.n);
  const sources = sourceRows.map(({ r, n }) => {
    const url = cell(r, "URL"), lastChecked = cell(r, "Last checked");
    if (!WebUrl.safeParse(url).success) add("Sources", n, "URL", `"${url}" is not a web address starting with https://.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastChecked)) add("Sources", n, "Last checked", "Write the date as YYYY-MM-DD.");
    return { id: cell(r, "ID"), title: cell(r, "Title"), publisher: cell(r, "Publisher"), url, lastChecked };
  });

  if (problems.length) throw new ContentError(problems);

  const rowsApproved = [...pathways, ...summary, ...actions, ...information].every((x) => x.approved);
  const parsed = PilotContent.safeParse({
    version: opts.version,
    status: rowsApproved ? "approved" : "draft",
    questionnaire: qDoc.success ? qDoc.data : undefined,
    settings, pathways, summary, actions, information, texts, services, sources,
  });
  if (!parsed.success) {
    const tabOf: Record<string, string> = { pathways: "Pathways", summary: "Summary", actions: "Actions", information: "Information", texts: "Texts", services: "Services", sources: "Sources", settings: "Settings", questionnaire: "Questions" };
    throw new ContentError(parsed.error.issues.map((iss) => {
      const [top, index, ...rest] = iss.path;
      const numbers = rowNumbers[top as keyof typeof rowNumbers];
      return { tab: tabOf[String(top)] ?? String(top), row: typeof index === "number" && numbers ? numbers[index] : undefined, column: rest.join(".") || (typeof index === "string" ? index : undefined), message: iss.message };
    }));
  }
  return parsed.data;
}

/* ------------------------------ content back to rows ------------------------------ */

const text = (c: Condition | undefined, written: string) => written || (c ? ruleToText(c) : "");

export function contentToRows(c: PilotContent): Rows {
  const q = c.questionnaire;
  const rows: Rows = {};
  rows[TABS.settings.name] = [
    { Key: SETTING_URGENT_WHEN, Value: text(c.settings.urgentWhen, c.settings.urgentWhenText) },
    { Key: SETTING_URGENT_ITEMS, Value: c.settings.urgentItemsQuestion ?? "" },
  ];
  rows[TABS.sections.name] = q.sections.map((s) => ({ ID: s.id, Title: s.title, Intro: s.intro ?? "", "Show when": s.when ? ruleToText(s.when) : "" }));
  rows[TABS.questions.name] = q.sections.flatMap((s) => s.questions.map((x) => {
    const declared = x.options.filter((o) => !(x.unsure as string[]).includes(o.value));
    return {
      ID: x.id, Section: s.id, Pathway: x.pathway ?? "", Type: TYPE_LABEL[x.type], Question: x.label, Help: x.help ?? "",
      Options: declared.map((o) => `${o.value} = ${o.label}`).join("\n"),
      "Exclusive options": declared.filter((o) => o.exclusive).map((o) => o.value).join(", "),
      "Unsure answers": x.unsure.map((u) => UNSURE_LABEL[u]).join(", "),
      Required: x.optional ? "no" : "yes", "Max choices": x.max ? String(x.max) : "",
      Rows: x.items.map((i) => `${i.id} = ${i.label}`).join("\n"),
      "Show when": x.when ? ruleToText(x.when) : "", Notes: x.notes ?? "",
    };
  }));
  const st = (ok: boolean) => (ok ? "Approved" : "Draft");
  rows[TABS.pathways.name] = c.pathways.map((p) => ({ ID: p.id, Name: p.name, "Show when": text(p.when, p.whenText), Explanation: p.explanation, Status: st(p.approved) }));
  rows[TABS.summary.name] = c.summary.map((s) => ({ ID: s.id, Section: SUMMARY_TEXT[s.section], "Show when": text(s.when, s.whenText), Text: s.text, Status: st(s.approved) }));
  rows[TABS.actions.name] = c.actions.map((a) => ({
    Key: a.key, Topic: a.topic, Priority: PRIORITY_TEXT[a.priority], "Show when": text(a.when, a.whenText),
    "What to do": a.title, "Why it matters": a.why, "Next step": a.nextStep,
    "Who can help": a.whoCanHelp.join("\n"), "What to prepare": a.prepare.join("\n"), "Questions to ask": a.questions.join("\n"), "Things to check": a.check.join("\n"),
    Source: a.sourceId ?? "", Status: st(a.approved),
  }));
  rows[TABS.information.name] = c.information.map((x) => ({ ID: x.id, Section: INFO_TEXT[x.section], "Show when": text(x.when, x.whenText), Title: x.title, Text: x.text, Source: x.sourceId ?? "", Status: st(x.approved) }));
  const textKeys = [...TEXT_KEYS.required, ...TEXT_KEYS.optional].filter((k) => c.texts[k] !== undefined);
  rows[TABS.texts.name] = textKeys.map((k) => ({ Key: k, Text: c.texts[k] }));
  rows[TABS.services.name] = c.services.map((s) => ({ ID: s.id, Label: s.label, Pathway: s.pathway ?? "" }));
  rows[TABS.sources.name] = c.sources.map((s) => ({ ID: s.id, Title: s.title, Publisher: s.publisher, URL: s.url, "Last checked": s.lastChecked }));
  return rows;
}
