import { afterAll, describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { PilotContent } from "../src/lib/pilot/content";
import { generatePilotPlan } from "../src/lib/pilot/engine";
import { renderPlanDocument, renderPlanSections } from "../src/lib/pilot/render";
import { INLINE_FONTS } from "../src/doc/fonts-inline";
import { closeBrowser, htmlToPdf, pageCount } from "../src/doc/pdf";
import { casesCsv, cell } from "../src/lib/csv";
import { FAMILIES } from "./pilot-families";

const content = PilotContent.parse(contentJson);
const NOW = new Date("2026-10-01T09:00:00Z");
const planFor = (i: number) => generatePilotPlan(content, FAMILIES[i].answers, FAMILIES[i].person, { now: NOW });
const doc = (plan: ReturnType<typeof planFor>, issuedOn = NOW) => renderPlanDocument(plan, { fonts: { kind: "url", base: "/fonts" }, issuedOn, reference: "AN-TEST01", coverNote: content.texts.plan_cover_note });

describe("the plan renderer", () => {
  it("escapes everything a navigator or family typed", () => {
    const plan = planFor(0);
    plan.actions[0].title = '<script>alert("x")</script>';
    plan.personName = "<b>Peggy</b>";
    const html = renderPlanSections(plan, { mode: "web" }) + doc(plan);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Peggy</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("leaves out sections with nothing to say, and removed actions", () => {
    const plan = planFor(3); // village family: no urgent block
    const html = renderPlanSections(plan, { mode: "web" });
    expect(html).not.toContain("urgent attention");
    const removed = plan.actions[0];
    removed.removed = true;
    expect(renderPlanSections(plan, { mode: "web" })).not.toContain(`>${removed.title}`);
  });

  it("shows the urgent block first when there is one", () => {
    const html = renderPlanSections(planFor(2), { mode: "web" });
    expect(html.indexOf("urgent attention")).toBeLessThan(html.indexOf("Your current situation"));
  });

  it("says 'Pathways to explore' when more than one applies, and the note when none does", () => {
    expect(renderPlanSections(planFor(6), { mode: "web" })).toContain("Pathways to explore");
    expect(renderPlanSections(planFor(2), { mode: "web" })).toContain(content.texts.pathway_none);
  });

  it("puts the date on the New Zealand calendar", () => {
    expect(doc(planFor(0), new Date("2026-09-30T22:30:00Z"))).toContain("1 October 2026");
  });

  it("writes the PDF footer as CSS text, so names with quotes or ampersands print as typed", () => {
    const plan = planFor(0);
    plan.personName = `O'Brien & "Co"`;
    const html = doc(plan);
    expect(html).toContain(`content: "Ageing Navigator · O'Brien & \\"Co\\" · AN-TEST01"`);
    expect(html).not.toMatch(/content: "[^"]*&amp;/);
  });

  it("puts no private link in the PDF, and leaves out texts a navigator cleared", () => {
    const plan = planFor(0);
    plan.intro = "";
    plan.cta = " ";
    const html = doc(plan);
    expect(html).not.toContain("/p/");
    expect(html).toContain("use the link in your email");
    expect(html).not.toMatch(/<p>\s*<\/p>/);
    expect(html).not.toContain('class="intro"');
  });
});

describe("the CSV export", () => {
  it("neutralises formulas and quotes separators", () => {
    expect(cell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(cell("a,b")).toBe('"a,b"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    const csv = casesCsv([{ reference: "AN-1", status: "released", answers: { q8: ["falls", "transport"], q21: { will: "yes" } }, pathways: ["stay_home"] }], content.questionnaire);
    expect(csv).toMatch(/AN-1,released/);
    expect(csv).toContain("falls|transport");
  });
});

describe.skipIf(!process.env.CHROME_PATH)("the PDF, with Chrome", () => {
  afterAll(() => closeBrowser());
  it.each(FAMILIES.map((f, i) => [f.id, i] as const))("renders %s on a sensible number of pages", async (_, i) => {
    const pdf = await htmlToPdf(renderPlanDocument(planFor(i), { fonts: { kind: "inline", files: INLINE_FONTS }, issuedOn: NOW, reference: "AN-TEST01", coverNote: content.texts.plan_cover_note }));
    const pages = pageCount(pdf);
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(10);
  }, 60_000);
});
