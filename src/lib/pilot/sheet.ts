import { z } from "zod";
import type { Condition, Priority } from "../schema";
import { Questionnaire, type QuestionDefinition } from "../questionnaire/schema";
import { fieldsOf } from "../engine/conditions";
import { parseRule, ruleToText, RuleError, type QuestionLookup } from "./rule-syntax";
import { PATHWAY_IDS, PilotContent, TEXT_KEYS, type PathwayId } from "./content";

/**
 * The content spreadsheet, as plain rows: one object per row, keyed by column header. `compileContent` turns the
 * rows into validated content and reports every problem with its tab, row and column; `contentToRows` does the
 * reverse, so the spreadsheet can be pre-filled from the current content. Reading and writing .xlsx files is the
 * scripts' job (`scripts/content-*.ts`); this file has no file or network access.
 */

export type Row = Record<string, string>;
export type Rows = Record<string, Row[]>;

export const TABS = {
  settings: { name: "Settings", columns: ["Key", "Value"] },
  sections: { name: "Sections", columns: ["ID", "Title", "Intro", "Show when"] },
  questions: { name: "Questions", columns: ["ID", "Section", "Pathway", "Type", "Question", "Help", "Options", "Exclusive options", "Unsure answers", "Required", "Max choices", "Rows", "Show when", "Notes"] },
  pathways: { name: "Pathways", columns: ["ID", "Name", "Show when", "Explanation", "Status"] },
  summary: { name: "Summary", columns: ["Section", "Show when", "Text", "Status"] },
  actions: { name: "Actions", columns: ["Key", "Topic", "Priority", "Show when", "What to do", "Why it matters", "Next step", "Who can help", "What to prepare", "Questions to ask", "Things to check", "Source", "Status"] },
  information: { name: "Information", columns: ["Section", "Show when", "Title", "Text", "Source", "Status"] },
  texts: { name: "Texts", columns: ["Key", "Text"] },
  services: { name: "Services", columns: ["ID", "Label", "Pathway"] },
  sources: { name: "Sources", columns: ["ID", "Title", "Publisher", "URL", "Last checked"] },
} as const;

const TYPE_LABEL: Record<QuestionDefinition["type"], string> = { single: "Single choice", multi: "Multiple choice", short: "Short text", long: "Long text", tri_grid: "Grid" };
export const UNSURE_LABEL = { unsure: "Unsure", dont_know: "Don't know", not_applicable: "Not applicable" } as const;
type UnsureId = keyof typeof UNSURE_LABEL;
const PRIORITY_TEXT: Record<Priority, string> = { now: "Now", soon: "Soon", plan_ahead: "Plan ahead" };
const SUMMARY_TEXT = { situation: "A. Your current situation", matters: "B. What matters most" } as const;
const INFO_TEXT = { funding: "E. Funding and assessment", check: "G. Things to check", professional: "H. Professional assessment or advice" } as const;
const SETTING_URGENT_WHEN = "Urgent when";
const SETTING_URGENT_ITEMS = "Urgent items question";

export type Problem = { tab: string; row?: number; column?: string; message: string };
export class ContentError extends Error {
  constructor(public problems: Problem[]) { super(`${problems.length} problem${problems.length === 1 ? "" : "s"} in the content`); }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cell = (row: Row, column: string) => {
  const want = norm(column);
  for (const [k, v] of Object.entries(row)) if (norm(k) === want) return String(v ?? "").trim();
  return "";
};
const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const isBlank = (row: Row) => Object.values(row).every((v) => !String(v ?? "").trim());

/** "value = Label" per line. A line with no "=" uses the label, turned into a value. */
function pairs(s: string) {
  return lines(s).map((l) => {
    const at = l.indexOf("=");
    if (at < 0) return { value: l.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label: l };
    return { value: l.slice(0, at).trim(), label: l.slice(at + 1).trim() };
  });
}

class Collector {
  problems: Problem[] = [];
  add(tab: string, row: number | undefined, column: string | undefined, message: string) { this.problems.push({ tab, row, column, message }); }
}

/** Row numbers as the spreadsheet shows them: the header is row 1. */
const rowNo = (i: number) => i + 2;

export function compileContent(rows: Rows, opts: { version: string }): PilotContent {
  const out = new Collector();
  const tab = (key: keyof typeof TABS) => (rows[TABS[key].name] ?? []).filter((r) => !isBlank(r));

  /* ---------- texts first: the questionnaire's title, intro and notice live there ---------- */
  const texts: Record<string, string> = {};
  tab("texts").forEach((r, i) => {
    const key = cell(r, "Key");
    if (!key) return out.add("Texts", rowNo(i), "Key", "A text has no key.");
    if (texts[key] !== undefined) out.add("Texts", rowNo(i), "Key", `"${key}" appears twice.`);
    texts[key] = cell(r, "Text");
  });
  const known = new Set<string>([...TEXT_KEYS.required, ...TEXT_KEYS.optional]);
  for (const k of Object.keys(texts)) if (!known.has(k)) out.add("Texts", undefined, "Key", `"${k}" is not a text the app uses. Known keys: ${[...known].join(", ")}.`);
  for (const k of TEXT_KEYS.required) if (!texts[k]?.trim()) out.add("Texts", undefined, "Text", `"${k}" is required.`);

  /* ---------- sections and questions ---------- */
  const sectionRows = tab("sections");
  const questionRows = tab("questions");
  const sections = sectionRows.map((r, i) => ({ i, id: cell(r, "ID"), title: cell(r, "Title"), intro: cell(r, "Intro"), whenText: cell(r, "Show when") }));
  const sectionIds = new Set(sections.map((s) => s.id));
  sections.forEach((s) => { if (!/^[a-z0-9_]+$/.test(s.id)) out.add("Sections", rowNo(s.i), "ID", `"${s.id}" is not a valid ID: use lower-case letters, numbers and underscores.`); });

  const typeByLabel = new Map<string, QuestionDefinition["type"]>(Object.entries(TYPE_LABEL).map(([k, v]) => [norm(v), k as QuestionDefinition["type"]]));
  for (const k of Object.keys(TYPE_LABEL)) typeByLabel.set(norm(k), k as QuestionDefinition["type"]);
  const unsureByLabel = new Map<string, UnsureId>(Object.entries(UNSURE_LABEL).map(([k, v]) => [norm(v), k as UnsureId]));

  type Draft = { i: number; section: string; whenText: string; q: Record<string, unknown> };
  const drafts: Draft[] = questionRows.map((r, i) => {
    const id = cell(r, "ID");
    const type = typeByLabel.get(norm(cell(r, "Type")));
    const section = cell(r, "Section");
    if (!/^[a-z0-9_]+$/.test(id)) out.add("Questions", rowNo(i), "ID", `"${id}" is not a valid ID: use lower-case letters, numbers and underscores.`);
    if (!type) out.add("Questions", rowNo(i), "Type", `"${cell(r, "Type")}" is not a type. Use: ${Object.values(TYPE_LABEL).join(", ")}.`);
    if (!sectionIds.has(section)) out.add("Questions", rowNo(i), "Section", `"${section}" is not in the Sections tab.`);
    const unsure = list(cell(r, "Unsure answers")).map((l) => {
      const u = unsureByLabel.get(norm(l));
      if (!u) out.add("Questions", rowNo(i), "Unsure answers", `"${l}" is not one of: ${Object.values(UNSURE_LABEL).join(", ")}.`);
      return u;
    }).filter((u): u is UnsureId => !!u);
    const declared = pairs(cell(r, "Options"));
    for (const o of declared) {
      if (!/^[a-z0-9_]+$/.test(o.value)) out.add("Questions", rowNo(i), "Options", `"${o.value}" is not a valid option value: use lower-case letters, numbers and underscores before the "=".`);
      if ((unsure as string[]).includes(o.value)) out.add("Questions", rowNo(i), "Options", `"${o.value}" is also in Unsure answers: keep it in one place.`);
    }
    const exclusive = new Set(list(cell(r, "Exclusive options")));
    for (const v of exclusive) if (!declared.some((o) => o.value === v)) out.add("Questions", rowNo(i), "Exclusive options", `"${v}" is not one of this question's options.`);
    if (exclusive.size && type !== "multi") out.add("Questions", rowNo(i), "Exclusive options", "Only multiple-choice questions have exclusive options.");
    if (unsure.length && type !== "single" && type !== "multi") out.add("Questions", rowNo(i), "Unsure answers", "Unsure answers apply to single and multiple choice questions.");
    const options = [
      ...declared.map((o) => ({ ...o, ...(exclusive.has(o.value) ? { exclusive: true } : {}) })),
      ...unsure.map((u) => ({ value: u, label: UNSURE_LABEL[u], ...(type === "multi" ? { exclusive: true } : {}) })),
    ];
    const required = norm(cell(r, "Required") || "yes");
    if (!["yes", "no"].includes(required)) out.add("Questions", rowNo(i), "Required", 'Write "yes" or "no".');
    const maxText = cell(r, "Max choices");
    const max = maxText ? Number(maxText) : undefined;
    if (maxText && (!Number.isInteger(max) || max! < 1)) out.add("Questions", rowNo(i), "Max choices", "Write a whole number, or leave it empty.");
    const pathway = cell(r, "Pathway");
    return {
      i, section, whenText: cell(r, "Show when"),
      q: {
        id, type, label: cell(r, "Question"), help: cell(r, "Help") || undefined, optional: required === "no",
        options, unsure, items: pairs(cell(r, "Rows")).map((p) => ({ id: p.value, label: p.label })),
        ...(max !== undefined && Number.isInteger(max) ? { max } : {}),
        ...(pathway ? { pathway } : {}),
      },
    };
  });

  // A lookup for rules: the questions as they will be, before conditions are attached.
  const lookup: QuestionLookup = new Map();
  for (const d of drafts) {
    const parsed = z.object({ id: z.string(), type: z.string(), options: z.array(z.object({ value: z.string(), label: z.string() })), items: z.array(z.object({ id: z.string(), label: z.string() })) }).safeParse(d.q);
    if (parsed.success) lookup.set(parsed.data.id, d.q as unknown as QuestionDefinition);
  }
  const order = new Map(drafts.map((d, n) => [String(d.q.id), n]));

  const rule = (tabName: string, i: number | undefined, text: string, before?: number): Condition | undefined => {
    if (!text) return undefined;
    try {
      const c = parseRule(text, lookup);
      if (before !== undefined) {
        for (const f of fieldsOf(c)) {
          const at = order.get(f.split(".")[0]);
          if (at !== undefined && at >= before) out.add(tabName, i, "Show when", `${f.split(".")[0]} is asked at the same point or later, so it cannot decide whether this is shown.`);
        }
      }
      return c;
    } catch (e) {
      out.add(tabName, i, "Show when", e instanceof RuleError ? e.message : String(e));
      return undefined;
    }
  };

  const questionnaireSections = sections.map((s) => {
    const firstIndex = drafts.findIndex((d) => d.section === s.id);
    const when = rule("Sections", rowNo(s.i), s.whenText, firstIndex < 0 ? undefined : firstIndex);
    const questions = drafts.filter((d) => d.section === s.id).map((d) => {
      const when = rule("Questions", rowNo(d.i), d.whenText, order.get(String(d.q.id)));
      return { ...d.q, ...(when ? { when } : {}) };
    });
    if (!questions.length) out.add("Sections", rowNo(s.i), "ID", `Section "${s.id}" has no questions.`);
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
  if (!qDoc.success) for (const issue of qDoc.error.issues) out.add("Questions", undefined, issue.path.join("."), issue.message);

  /* ---------- placeholders ---------- */
  const placeholders = (tabName: string, i: number, column: string, text: string) => {
    for (const m of text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
      const p = m[1];
      if (p === "name") continue;
      const a = /^answer\.([a-z0-9_]+)$/.exec(p);
      const type = a ? lookup.get(a[1])?.type : undefined;
      if (type === "single" || type === "multi") continue;
      out.add(tabName, rowNo(i), column, a && type
        ? `{{${p}}}: only choice questions can be placed in wording, so a family's own typing never appears inside a sentence.`
        : `{{${p}}} is not a placeholder. Use {{name}} or {{answer.QUESTION_ID}} for a choice question.`);
    }
    return text;
  };
  const status = (tabName: string, i: number, r: Row) => {
    const s = norm(cell(r, "Status") || "draft");
    if (s !== "approved" && s !== "draft") out.add(tabName, rowNo(i), "Status", 'Write "Approved" or "Draft".');
    return s === "approved";
  };

  /* ---------- settings ---------- */
  const settings: Record<string, unknown> = { urgentWhenText: "" };
  tab("settings").forEach((r, i) => {
    const key = norm(cell(r, "Key"));
    const value = cell(r, "Value");
    if (key === norm(SETTING_URGENT_WHEN)) { settings.urgentWhenText = value; settings.urgentWhen = rule("Settings", rowNo(i), value); }
    else if (key === norm(SETTING_URGENT_ITEMS)) {
      if (value && lookup.get(value)?.type !== "multi") out.add("Settings", rowNo(i), "Value", `"${value}" is not a multiple-choice question.`);
      if (value) settings.urgentItemsQuestion = value;
    } else out.add("Settings", rowNo(i), "Key", `"${cell(r, "Key")}" is not a setting. Settings: ${SETTING_URGENT_WHEN}, ${SETTING_URGENT_ITEMS}.`);
  });

  /* ---------- pathways, summary, actions, information ---------- */
  const pathways = tab("pathways").map((r, i) => {
    const id = cell(r, "ID") as PathwayId;
    if (!(PATHWAY_IDS as readonly string[]).includes(id)) out.add("Pathways", rowNo(i), "ID", `"${id}" is not a pathway. Use: ${PATHWAY_IDS.join(", ")}.`);
    const whenText = cell(r, "Show when");
    return { id, name: cell(r, "Name"), explanation: placeholders("Pathways", i, "Explanation", cell(r, "Explanation")), approved: status("Pathways", i, r), whenText, when: rule("Pathways", rowNo(i), whenText) };
  });

  const summary = tab("summary").map((r, i) => {
    const s = norm(cell(r, "Section"));
    const section = s.startsWith("a") || s.includes("situation") ? "situation" : s.startsWith("b") || s.includes("matters") ? "matters" : undefined;
    if (!section) out.add("Summary", rowNo(i), "Section", `Write "${SUMMARY_TEXT.situation}" or "${SUMMARY_TEXT.matters}".`);
    const whenText = cell(r, "Show when");
    return { section, text: placeholders("Summary", i, "Text", cell(r, "Text")), approved: status("Summary", i, r), whenText, when: rule("Summary", rowNo(i), whenText) };
  });

  const priorityByText = new Map<string, Priority>(Object.entries(PRIORITY_TEXT).map(([k, v]) => [norm(v), k as Priority]));
  const actions = tab("actions").map((r, i) => {
    const priority = priorityByText.get(norm(cell(r, "Priority")));
    if (!priority) out.add("Actions", rowNo(i), "Priority", `Write ${Object.values(PRIORITY_TEXT).join(", ")}.`);
    const whenText = cell(r, "Show when");
    const text = (column: string) => placeholders("Actions", i, column, cell(r, column));
    return {
      key: cell(r, "Key"), topic: cell(r, "Topic"), priority,
      title: text("What to do"), why: text("Why it matters"), nextStep: text("Next step"),
      whoCanHelp: lines(text("Who can help")), prepare: lines(text("What to prepare")), questions: lines(text("Questions to ask")), check: lines(text("Things to check")),
      ...(cell(r, "Source") ? { sourceId: cell(r, "Source") } : {}),
      approved: status("Actions", i, r), whenText, when: rule("Actions", rowNo(i), whenText),
    };
  });

  const information = tab("information").map((r, i) => {
    const s = norm(cell(r, "Section"));
    const section = s.startsWith("e") || s.includes("funding") ? "funding" : s.startsWith("g") || s.includes("check") ? "check" : s.startsWith("h") || s.includes("professional") ? "professional" : undefined;
    if (!section) out.add("Information", rowNo(i), "Section", `Write one of: ${Object.values(INFO_TEXT).join("; ")}.`);
    const whenText = cell(r, "Show when");
    return {
      section, title: placeholders("Information", i, "Title", cell(r, "Title")), text: placeholders("Information", i, "Text", cell(r, "Text")),
      ...(cell(r, "Source") ? { sourceId: cell(r, "Source") } : {}),
      approved: status("Information", i, r), whenText, when: rule("Information", rowNo(i), whenText),
    };
  });

  const services = tab("services").map((r, i) => {
    const pathway = cell(r, "Pathway");
    if (pathway && !(PATHWAY_IDS as readonly string[]).includes(pathway)) out.add("Services", rowNo(i), "Pathway", `"${pathway}" is not a pathway. Use: ${PATHWAY_IDS.join(", ")}, or leave it empty.`);
    return { id: cell(r, "ID"), label: cell(r, "Label"), ...(pathway ? { pathway } : {}) };
  });

  const sources = tab("sources").map((r) => ({ id: cell(r, "ID"), title: cell(r, "Title"), publisher: cell(r, "Publisher"), url: cell(r, "URL"), lastChecked: cell(r, "Last checked") }));

  const rowsApproved = [...pathways, ...summary, ...actions, ...information].every((x) => x.approved);
  const draft = {
    version: opts.version,
    status: rowsApproved ? "approved" : "draft",
    questionnaire: qDoc.success ? qDoc.data : undefined,
    settings, pathways, summary, actions, information, texts, services, sources,
  };
  if (out.problems.length) throw new ContentError(out.problems);

  const parsed = PilotContent.safeParse(draft);
  if (!parsed.success) {
    const tabOf: Record<string, string> = { pathways: "Pathways", summary: "Summary", actions: "Actions", information: "Information", texts: "Texts", services: "Services", sources: "Sources", settings: "Settings", questionnaire: "Questions" };
    throw new ContentError(parsed.error.issues.map((iss) => {
      const [top, index, ...rest] = iss.path;
      return { tab: tabOf[String(top)] ?? String(top), row: typeof index === "number" ? rowNo(index) : undefined, column: rest.join(".") || undefined, message: iss.message };
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
      "Show when": x.when ? ruleToText(x.when) : "", Notes: "",
    };
  }));
  const st = (approved: boolean) => (approved ? "Approved" : "Draft");
  rows[TABS.pathways.name] = c.pathways.map((p) => ({ ID: p.id, Name: p.name, "Show when": text(p.when, p.whenText), Explanation: p.explanation, Status: st(p.approved) }));
  rows[TABS.summary.name] = c.summary.map((s) => ({ Section: SUMMARY_TEXT[s.section], "Show when": text(s.when, s.whenText), Text: s.text, Status: st(s.approved) }));
  rows[TABS.actions.name] = c.actions.map((a) => ({
    Key: a.key, Topic: a.topic, Priority: PRIORITY_TEXT[a.priority], "Show when": text(a.when, a.whenText),
    "What to do": a.title, "Why it matters": a.why, "Next step": a.nextStep,
    "Who can help": a.whoCanHelp.join("\n"), "What to prepare": a.prepare.join("\n"), "Questions to ask": a.questions.join("\n"), "Things to check": a.check.join("\n"),
    Source: a.sourceId ?? "", Status: st(a.approved),
  }));
  rows[TABS.information.name] = c.information.map((x) => ({ Section: INFO_TEXT[x.section], "Show when": text(x.when, x.whenText), Title: x.title, Text: x.text, Source: x.sourceId ?? "", Status: st(x.approved) }));
  const textKeys = [...TEXT_KEYS.required, ...TEXT_KEYS.optional].filter((k) => c.texts[k] !== undefined);
  rows[TABS.texts.name] = textKeys.map((k) => ({ Key: k, Text: c.texts[k] }));
  rows[TABS.services.name] = c.services.map((s) => ({ ID: s.id, Label: s.label, Pathway: s.pathway ?? "" }));
  rows[TABS.sources.name] = c.sources.map((s) => ({ ID: s.id, Title: s.title, Publisher: s.publisher, URL: s.url, "Last checked": s.lastChecked }));
  return rows;
}

