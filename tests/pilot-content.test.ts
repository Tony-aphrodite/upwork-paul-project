import { describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { PilotContent } from "../src/lib/pilot/content";
import { parseRule, ruleToText, RuleError } from "../src/lib/pilot/rule-syntax";
import { compileContent, contentToRows, ContentError, type Rows } from "../src/lib/pilot/sheet";
import { generatePilotPlan, tidyName } from "../src/lib/pilot/engine";
import { citedSources, liveActions, thingsToCheck } from "../src/lib/pilot/plan";
import { questionIndex, visibleSections } from "../src/lib/questionnaire/logic";
import { test as holds } from "../src/lib/engine/conditions";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const qs = questionIndex(content.questionnaire);
const NOW = new Date("2026-10-01T09:00:00Z");

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
  ])("explains a mistake: %s", (rule, message) => {
    expect(() => parseRule(rule, qs)).toThrow(RuleError);
    expect(() => parseRule(rule, qs)).toThrow(message);
  });

  it("prints every condition in the content back to text that parses to the same thing", () => {
    const conditions = [
      ...content.questionnaire.sections.flatMap((s) => [s.when, ...s.questions.map((q) => q.when)]),
      ...content.actions.map((a) => a.when), ...content.pathways.map((p) => p.when), ...content.summary.map((s) => s.when), ...content.information.map((i) => i.when),
    ].filter((c) => c !== undefined);
    expect(conditions.length).toBeGreaterThan(60);
    for (const c of conditions) expect(parseRule(ruleToText(c), qs)).toEqual(c);
  });
});

describe("the content spreadsheet", () => {
  it("round-trips: content to rows and back gives the same content", () => {
    const again = compileContent(contentToRows(content), { version: content.version });
    expect(again).toEqual(content);
  });

  it("reports problems with the tab, row and column", () => {
    const rows = contentToRows(content) as Rows;
    rows.Actions[2] = { ...rows.Actions[2], "Show when": "q19 is maybe", Priority: "Urgent" };
    rows.Questions[0] = { ...rows.Questions[0], Type: "Dropdown" };
    rows.Summary[0] = { ...rows.Summary[0], Text: "{{carer}} helps out." };
    try {
      compileContent(rows, { version: "x" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      const found = (e as ContentError).problems.map((p) => `${p.tab} ${p.row} ${p.column}`);
      expect(found).toEqual(expect.arrayContaining(["Actions 4 Show when", "Actions 4 Priority", "Questions 2 Type", "Summary 2 Text"]));
    }
  });

  it("refuses a show-when that looks at a question asked later", () => {
    const rows = contentToRows(content) as Rows;
    const i = rows.Questions.findIndex((r) => r.ID === "q2");
    rows.Questions[i] = { ...rows.Questions[i], "Show when": "q23 is village" };
    expect(() => compileContent(rows, { version: "x" })).toThrow(ContentError);
  });

  it("adds Unsure answers as exclusive options with standard labels", () => {
    const rows = contentToRows(content) as Rows;
    const i = rows.Questions.findIndex((r) => r.ID === "q8");
    rows.Questions[i] = { ...rows.Questions[i], "Unsure answers": "Don't know, Not applicable" };
    const q = questionIndex(compileContent(rows, { version: "x" }).questionnaire).get("q8")!;
    expect(q.options.slice(-2)).toEqual([{ value: "dont_know", label: "Don't know", exclusive: true }, { value: "not_applicable", label: "Not applicable", exclusive: true }]);
    expect(q.unsure).toEqual(["dont_know", "not_applicable"]);
  });

  it("does not allow a family's own typing inside a sentence", () => {
    const rows = contentToRows(content) as Rows;
    rows.Summary[0] = { ...rows.Summary[0], Text: "They said: {{answer.q10}}" };
    expect(() => compileContent(rows, { version: "x" })).toThrow(ContentError);
  });

  it("is marked draft until every row is approved", () => {
    expect(content.status).toBe("draft");
    const rows = contentToRows(content) as Rows;
    for (const t of ["Pathways", "Summary", "Actions", "Information"]) rows[t] = rows[t].map((r) => ({ ...r, Status: "Approved" }));
    expect(compileContent(rows, { version: "x" }).status).toBe("approved");
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
    // Every visible answer to a required question was allowed by the questionnaire.
    for (const s of visibleSections(content.questionnaire, f.answers)) for (const q of s.questions) if (!q.optional) expect(f.answers[q.id], `${f.id} ${q.id}`).toBeDefined();
  });

  it("orders actions Now, then Soon, then Plan ahead", () => {
    const plan = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, { now: NOW });
    const ranks = plan.actions.map((a) => ["now", "soon", "plan_ahead"].indexOf(a.priority));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("drops a sentence whose placeholder has nothing specific to say", () => {
    const f = FAMILIES[0];
    const plan = generatePilotPlan(content, { ...f.answers, q12: ["not_sure"] }, f.person, { now: NOW });
    expect(plan.situation.join(" ")).not.toMatch(/needs help with/);
    expect(generatePilotPlan(content, f.answers, f.person, { now: NOW }).situation.join(" ")).toMatch(/needs help with housework and shopping/);
  });

  it("tidies names and never uses gendered pronouns of its own", () => {
    expect(tidyName("  mary  jane ")).toBe("Mary Jane");
    expect(tidyName("McLaren")).toBe("McLaren");
    const plan = generatePilotPlan(content, FAMILIES[0].answers, { firstName: "dad", contactName: "paul mclaren" }, { now: NOW });
    expect(plan.personName).toBe("Dad");
    expect(plan.preparedFor).toBe("Paul Mclaren");
    expect(JSON.stringify(plan)).not.toMatch(/\b(he|she|him|her|his|hers)\b/i);
  });

  it("collects things to check and cited sources from what is still on the plan", () => {
    const plan = generatePilotPlan(content, FAMILIES[0].answers, FAMILIES[0].person, { now: NOW });
    const before = thingsToCheck(plan).length;
    const withCheck = plan.actions.find((a) => a.check.length)!;
    withCheck.removed = true;
    expect(thingsToCheck(plan).length).toBeLessThan(before);
    expect(liveActions(plan)).not.toContain(withCheck);
    for (const s of citedSources(plan)) expect(liveActions(plan).some((a) => a.sourceId === s.id) || plan.information.some((i) => i.sourceId === s.id)).toBe(true);
  });
});
