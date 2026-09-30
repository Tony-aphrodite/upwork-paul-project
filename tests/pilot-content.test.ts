import { describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { PilotContent } from "../src/lib/pilot/content";
import { parseRule, ruleToText, RuleError } from "../src/lib/pilot/rule-syntax";
import { compileContent, contentToRows, ContentError, type Rows } from "../src/lib/pilot/sheet";
import { generatePilotPlan, tidyName } from "../src/lib/pilot/engine";
import { citedSources, liveActions, thingsToCheck } from "../src/lib/pilot/plan";
import { checkSection, cleanAnswers, pruneAnswers, questionIndex, visibleSections } from "../src/lib/questionnaire/logic";
import { Questionnaire } from "../src/lib/questionnaire/schema";
import { test as holds } from "../src/lib/rules/condition";
import { list } from "../src/lib/text";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const qs = questionIndex(content.questionnaire);
const NOW = new Date("2026-10-01T09:00:00Z");
const rowsOf = () => contentToRows(content) as Rows;
const problemsOf = (rows: Rows) => {
  try { compileContent(rows, { version: "x" }); return []; } catch (e) { if (e instanceof ContentError) return e.problems; throw e; }
};

describe("the condition language", () => {
  it("reads the forms the spreadsheet uses", () => {
    expect(parseRule("q19 is completed", qs)).toEqual({ field: "q19", op: "eq", value: "completed" });
    expect(parseRule("q19 is not completed", qs)).toEqual({ field: "q19", op: "neq", value: "completed" });
    expect(parseRule("q19 in completed, receiving", qs)).toEqual({ field: "q19", op: "in", value: ["completed", "receiving"] });
    expect(parseRule("q19 not in none, unsure", qs)).toEqual({ not: { field: "q19", op: "in", value: ["none", "unsure"] } });
    expect(parseRule("q8 has falls", qs)).toEqual({ field: "q8", op: "includes", value: "falls" });
    expect(parseRule("q8 has any falls, transport", qs)).toEqual({ any: [{ field: "q8", op: "includes", value: "falls" }, { field: "q8", op: "includes", value: "transport" }] });
    expect(parseRule("q21.epoa_property is no", qs)).toEqual({ field: "q21.epoa_property", op: "eq", value: "no" });
    expect(parseRule("q11a answered", qs)).toEqual({ field: "q11a", op: "truthy" });
    expect(parseRule("q11a not answered", qs)).toEqual({ field: "q11a", op: "falsy" });
  });

  it("gives 'and' priority over 'or', and respects brackets", () => {
    const loose = parseRule("q6 is alone or q6 is with_partner and q18 is yes", qs);
    expect(holds(loose, { q6: "alone", q18: "no" })).toBe(true);
    const tight = parseRule("(q6 is alone or q6 is with_partner) and q18 is yes", qs);
    expect(holds(tight, { q6: "alone", q18: "no" })).toBe(false);
    expect(holds(parseRule("not q8 has falls", qs), { q8: ["transport"] })).toBe(true);
  });

  it.each([
    ["q99 is yes", /no question "q99"/],
    ["q19 is maybe", /"maybe" is not an option of q19/],
    ["q8 is falls", /multiple choice: use "has"/],
    ["q19 has none", /"has" works with multiple-choice/],
    ["q21 is yes", /is a grid: name a row/],
    ["q21.pets is yes", /not a row of q21/],
    ["q10 is worried", /text question: use "answered"/],
    ["q19 is completed q8 has falls", /Join conditions with "and" or "or"/],
    ["(q19 is completed", /bracket is not closed/],
    ["q19 = completed", /cannot be used in a condition/],
    ["q8 has falls, transport", /has any a, b/],
    ["q19 is completed, receiving", /write "q19 in a, b"/],
  ])("explains a mistake: %s", (rule, message) => {
    expect(() => parseRule(rule, qs)).toThrow(RuleError);
    expect(() => parseRule(rule, qs)).toThrow(message);
  });

  it("prints every condition in the content back to text that parses to the same thing", () => {
    const conditions = [
      ...content.questionnaire.sections.flatMap((s) => [s.when, ...s.questions.map((q) => q.when)]),
      ...content.actions.map((a) => a.when), ...content.pathways.map((p) => p.when), ...content.summary.map((s) => s.when), ...content.information.map((i) => i.when),
      content.settings.urgentWhen,
    ].filter((c) => c !== undefined);
    expect(conditions.length).toBeGreaterThan(60);
    for (const c of conditions) expect(parseRule(ruleToText(c), qs)).toEqual(c);
  });
});

describe("the content spreadsheet", () => {
  it("round-trips: content to rows and back gives the same content, notes and row IDs included", () => {
    const rows = rowsOf();
    const q = rows.Questions.find((r) => r.ID === "q8")!;
    q.Notes = "Checked with the GP liaison";
    const again = compileContent(rows, { version: content.version });
    expect(questionIndex(again.questionnaire).get("q8")!.notes).toBe("Checked with the GP liaison");
    const back = compileContent(contentToRows(again) as Rows, { version: content.version });
    expect(back).toEqual(again);
    expect(compileContent(rowsOf(), { version: content.version })).toEqual(content);
  });

  it("reports problems with the tab, the sheet's own row number and the column", () => {
    const rows = rowsOf();
    rows.Actions = rows.Actions.map((r, i) => ({ ...r, __row: String(i + 3) })); // a blank row 2 was skipped when reading
    rows.Actions[2] = { ...rows.Actions[2], "Show when": "q19 is maybe", Priority: "Urgent" };
    rows.Questions[0] = { ...rows.Questions[0], Type: "Dropdown" };
    rows.Summary[0] = { ...rows.Summary[0], Text: "{{carer}} helps out." };
    const found = problemsOf(rows).map((p) => `${p.tab} ${p.row} ${p.column}`);
    expect(found).toEqual(expect.arrayContaining(["Actions 5 Show when", "Actions 5 Priority", "Questions 2 Type", "Summary 2 Text"]));
  });

  it("points a bad source at the right tab and row", () => {
    const rows = rowsOf();
    rows.Information[1] = { ...rows.Information[1], Source: "made-up" };
    expect(problemsOf(rows)).toEqual([expect.objectContaining({ tab: "Information", row: 3, message: expect.stringMatching(/made-up/) })]);
  });

  it("judges 'asked later' by the order families see: sections first, then questions", () => {
    const moved = rowsOf();
    const s7 = moved.Sections.findIndex((r) => r.ID === "s7");
    moved.Sections.unshift(...moved.Sections.splice(s7, 1)); // s7 now comes first
    const q24 = moved.Questions.findIndex((r) => r.ID === "q24");
    moved.Questions[q24] = { ...moved.Questions[q24], "Show when": "q6 is alone" }; // q6 is now asked after q24
    expect(problemsOf(moved).some((p) => p.tab === "Questions" && /q6 is asked at the same point or later/.test(p.message))).toBe(true);

    const sorted = rowsOf();
    sorted.Questions.sort((a, b) => a.ID.localeCompare(b.ID)); // the Questions tab's own order does not matter
    expect(problemsOf(sorted)).toEqual([]);
  });

  it("refuses a show-when that looks at a question asked later", () => {
    const rows = rowsOf();
    const i = rows.Questions.findIndex((r) => r.ID === "q2");
    rows.Questions[i] = { ...rows.Questions[i], "Show when": "q23 is village" };
    expect(problemsOf(rows).length).toBeGreaterThan(0);
  });

  it("adds Unsure answers as exclusive options with standard labels", () => {
    const rows = rowsOf();
    const i = rows.Questions.findIndex((r) => r.ID === "q8");
    rows.Questions[i] = { ...rows.Questions[i], "Unsure answers": "Don't know, Not applicable" };
    const q = questionIndex(compileContent(rows, { version: "x" }).questionnaire).get("q8")!;
    expect(q.options.slice(-2)).toEqual([{ value: "dont_know", label: "Don't know", exclusive: true }, { value: "not_applicable", label: "Not applicable", exclusive: true }]);
    expect(q.unsure).toEqual(["dont_know", "not_applicable"]);
  });

  it("does not allow a family's own typing inside a sentence", () => {
    const rows = rowsOf();
    rows.Summary[0] = { ...rows.Summary[0], Text: "They said: {{answer.q10}}" };
    expect(problemsOf(rows).length).toBe(1);
  });

  it("checks the placeholders each text may use", () => {
    const rows = rowsOf();
    const set = (key: string, text: string) => { rows.Texts.find((r) => r.Key === key)!.Text = text; };
    set("plan_intro", "For {{name}} in {{town}}.");
    set("thank_you", "Thanks {{name}}.");
    set("email_release_body", "Your plan: {{link}} until {{expires}}, {{name}}.");
    const texts = problemsOf(rows).filter((p) => p.tab === "Texts").map((p) => p.message);
    expect(texts).toHaveLength(3);
    const noLink = rowsOf();
    noLink.Texts.find((r) => r.Key === "email_release_body")!.Text = "Your plan is ready.";
    expect(problemsOf(noLink).some((p) => /must contain \{\{link\}\}/.test(p.message))).toBe(true);
    const pathway = rowsOf();
    pathway.Pathways[0].Explanation = "Staying home fits {{answer.q23}}.";
    expect(problemsOf(pathway).some((p) => p.tab === "Pathways" && /only \{\{name\}\}/.test(p.message))).toBe(true);
  });

  it("refuses option values that conditions could never use, and unsafe source addresses", () => {
    const rows = rowsOf();
    const q = rows.Questions.find((r) => r.ID === "q13")!;
    q.Options = `${q.Options}\nany = Any of these`;
    rows.Sources[0].URL = "javascript:alert(1)";
    const found = problemsOf(rows);
    expect(found.some((p) => /"any" cannot be an option value/.test(p.message))).toBe(true);
    expect(found.some((p) => p.tab === "Sources" && /https/.test(p.message))).toBe(true);
  });

  it("gives new summary and information rows IDs after the highest in use, and keeps existing ones", () => {
    const rows = rowsOf();
    rows.Summary.push({ ID: "", Section: "A. Your current situation", "Show when": "", Text: "A new sentence.", Status: "Draft" });
    const out = compileContent(rows, { version: "x" });
    expect(out.summary.map((s) => s.id).slice(0, -1)).toEqual(content.summary.map((s) => s.id));
    expect(out.summary.at(-1)!.id).toBe(`summary-${content.summary.length + 1}`);
  });

  it("is marked draft until every row is approved", () => {
    expect(content.status).toBe("draft");
    const rows = rowsOf();
    for (const t of ["Pathways", "Summary", "Actions", "Information"]) rows[t] = rows[t].map((r) => ({ ...r, Status: "Approved" }));
    expect(compileContent(rows, { version: "x" }).status).toBe("approved");
  });
});

describe("the questionnaire logic", () => {
  it("prunes until nothing hidden is left, even along a chain", () => {
    const doc = Questionnaire.parse({
      id: "t", version: "1", title: "t", notice: "n",
      sections: [
        { id: "a", title: "A", questions: [{ id: "q1", type: "single", label: "Q1", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }] },
        { id: "b", title: "B", when: { field: "q1", op: "eq", value: "yes" }, questions: [{ id: "q2", type: "short", label: "Q2" }] },
        { id: "c", title: "C", questions: [{ id: "q3", type: "short", label: "Q3", when: { field: "q2", op: "truthy" } }] },
      ],
    });
    expect(pruneAnswers(doc, { q1: "no", q2: "x", q3: "y" })).toEqual({ q1: "no" });
  });

  it("offers 'or choose Not sure' only where Not sure exists", () => {
    const section = visibleSections(content.questionnaire, {})[0];
    const msg = (id: string) => checkSection({ ...section, questions: [qs.get(id)!] }, {})[0].message;
    expect(msg("q8")).toMatch(/or choose Not sure/);
    expect(msg("q5_town")).toBe("Please answer this question.");
  });

  it("keeps only answers that fit the current questionnaire", () => {
    expect(cleanAnswers(content.questionnaire, { q8: ["falls", "made-up"], q99: "x", q6: "moon", q10: "  worried  " })).toEqual({ q8: ["falls"], q10: "worried" });
    expect(cleanAnswers(content.questionnaire, { q17: ["none_of_these", "falling"] })).toEqual({ q17: ["falling"] });
  });
});

describe("the pilot engine", () => {
  it.each(FAMILIES.map((f) => [f.id, f] as const))("%s gets a coherent plan", (_, f) => {
    const plan = generatePilotPlan(content, f.answers, f.person, { now: NOW });
    expect(plan.pathways.map((p) => p.id)).toEqual(f.expect.pathways);
    for (const key of f.expect.actions) expect(plan.actions.map((a) => a.key)).toContain(key);
    for (const key of f.expect.notActions ?? []) expect(plan.actions.map((a) => a.key)).not.toContain(key);
    expect(!!plan.urgent).toBe(!!f.expect.urgent);
    const all = JSON.stringify(plan);
    expect(all).not.toMatch(/\{\{|\}\}/);
    expect(all).not.toMatch(/\bundefined\b/);
    for (const s of visibleSections(content.questionnaire, f.answers)) for (const q of s.questions) if (!q.optional) expect(f.answers[q.id], `${f.id} ${q.id}`).toBeDefined();
  });

  it("treats 'Not sure' plus a named concern as urgent", () => {
    const f = FAMILIES[0];
    const plan = generatePilotPlan(content, { ...f.answers, q18: "unsure", q18a: ["concern_about_neglect_abuse_or_exploitation"] }, f.person, { now: NOW });
    expect(plan.urgent?.items).toEqual(["Concern about neglect, abuse or exploitation"]);
    expect(plan.actions[0].key).toBe("urgent-first");
    expect(generatePilotPlan(content, { ...f.answers, q18: "unsure" }, f.person, { now: NOW }).urgent).toBeUndefined();
  });

  it("does not state a wish nobody stated", () => {
    const f = FAMILIES.find((x) => x.id === "not-sure")!;
    const plan = generatePilotPlan(content, f.answers, f.person, { now: NOW });
    expect(JSON.stringify(plan)).not.toMatch(/would like to stay at home|wants about where to live/);
  });

  it("orders actions Now, then Soon, then Plan ahead, also after a navigator changes a priority", () => {
    const plan = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, { now: NOW });
    const ranks = (xs: { priority: string }[]) => xs.map((a) => ["now", "soon", "plan_ahead"].indexOf(a.priority));
    expect(ranks(plan.actions)).toEqual([...ranks(plan.actions)].sort((a, b) => a - b));
    const last = plan.actions.at(-1)!;
    last.priority = "now";
    expect(liveActions(plan)[0].key).toBe(last.key);
  });

  it("drops a sentence whose placeholder has nothing specific to say, but keeps specific 'other…' answers", () => {
    const f = FAMILIES[0];
    const vague = generatePilotPlan(content, { ...f.answers, q12: ["not_sure"] }, f.person, { now: NOW });
    expect(vague.situation.join(" ")).not.toMatch(/needs help with/);
    expect(generatePilotPlan(content, f.answers, f.person, { now: NOW }).situation.join(" ")).toMatch(/needs help with housework and shopping/);
    const family = generatePilotPlan(content, { ...f.answers, q14: ["help_from_friends_or_neighbours", "other"] }, f.person, { now: NOW });
    expect(family.situation.join(" ")).toMatch(/Support in place now: help from friends or neighbours\./);
  });

  it("keeps names and acronyms capitalised inside sentences, and separates labels that contain commas", () => {
    const f = FAMILIES[0];
    const plan = generatePilotPlan(content, { ...f.answers, q12: ["showering_dressing_or_personal_care", "preparing_meals"] }, f.person, { now: NOW });
    expect(plan.situation.join(" ")).toMatch(/needs help with showering, dressing or personal care; and preparing meals/);
    expect(list(["GP", "Te Whatu Ora"])).toBe("GP and Te Whatu Ora");
  });

  it("tidies names and never uses gendered pronouns of its own", () => {
    expect(tidyName("  mary  jane ")).toBe("Mary Jane");
    expect(tidyName("McLaren")).toBe("McLaren");
    const plan = generatePilotPlan(content, FAMILIES[0].answers, { firstName: "dad", contactName: "paul mclaren" }, { now: NOW });
    expect(plan.personName).toBe("Dad");
    expect(plan.preparedFor).toBe("Paul Mclaren");
    expect(JSON.stringify(plan)).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
  });

  it("collects things to check and numbers sources in the order the plan first cites them", () => {
    const plan = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, { now: NOW });
    const before = thingsToCheck(plan).length;
    const withCheck = plan.actions.find((a) => a.check.length)!;
    withCheck.removed = true;
    expect(thingsToCheck(plan).length).toBeLessThan(before);
    const firstUse = [...new Set(liveActions(plan).map((a) => a.sourceId).filter(Boolean))];
    expect(citedSources(plan).map((s) => s.id).slice(0, firstUse.length)).toEqual(firstUse);
  });
});
