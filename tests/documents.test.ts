import { describe, expect, it, afterAll } from "vitest";
import { renderPlanHtml, renderSummaryHtml } from "../src/doc/templates";
import { INLINE_FONTS } from "../src/doc/fonts-inline";
import { CASE_IDS, planOf, profileOf } from "./helpers";

const fonts = { kind: "inline" as const, files: INLINE_FONTS };
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

describe("templates", () => {
  it("escapes everything that comes from data", () => {
    const profile = profileOf("alone-with-falls");
    const evil = { ...profile, person: { ...profile.person, firstName: `<img src=x onerror=alert(1)>` }, goals: [`</p><script>alert(1)</script>`] };
    const plan = planOf("alone-with-falls");
    const html = renderPlanHtml({ ...plan, summary: { ...plan.summary, situation: [`<b>bold</b>`] } }, evil, { fonts }) + renderSummaryHtml(plan, evil, { fonts });
    expect(html).not.toMatch(/<script>alert|<img src=x/);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("leaves out modules and sections that do not apply", () => {
    const html = text(renderPlanHtml(planOf("healthy-couple"), profileOf("healthy-couple"), { fonts }));
    expect(html).not.toMatch(/Hospital discharge|Falls and mobility|Respite/);
    expect(html).toMatch(/Retirement villages/);
  });
  it("shows the plan version, reference and date on the cover", () => {
    const html = renderPlanHtml(planOf("residential-care"), profileOf("residential-care"), { fonts });
    expect(html).toMatch(/Version 1\.0/);
    expect(html).toMatch(/AP-TEST01/);
    expect(html).toMatch(/22 September 2026/);
  });
  it("every recommended action appears in the next-steps table and the checklist", () => {
    for (const id of CASE_IDS) {
      const plan = planOf(id);
      const html = text(renderPlanHtml(plan, profileOf(id), { fonts }));
      for (const a of plan.actions) expect(html.split(a.title.replace(/'/g, "&#39;")).length - 1, `${id}: ${a.title}`).toBeGreaterThanOrEqual(2);
    }
  });
  it("the professional summary covers every item the brief lists", () => {
    const html = text(renderSummaryHtml(planOf("dementia-exhausted-spouse"), profileOf("dementia-exhausted-spouse"), { fonts }));
    for (const k of ["Current living situation", "Existing support", "Mobility", "Recent significant events", "Main concerns", "Family goals", "Current services", "Existing assessments", "EPOA status", "Main priorities", "Actions already underway"]) expect(html, k).toContain(k);
  });
});

// Real PDF rendering needs a Chrome binary; set CHROME_PATH to run these (the QA script does).
describe.skipIf(!process.env.CHROME_PATH)("PDF output", () => {
  afterAll(async () => (await import("../src/doc/pdf")).closeBrowser());
  it("renders every case; summaries stay within 2 pages; nothing overflows the page", async () => {
    const { htmlToPdf, pageCount } = await import("../src/doc/pdf");
    const puppeteer = (await import("puppeteer-core")).default;
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
    try {
      for (const id of CASE_IDS) {
        const plan = planOf(id), profile = profileOf(id);
        const planPdf = await htmlToPdf(renderPlanHtml(plan, profile, { fonts }));
        const sumPdf = await htmlToPdf(renderSummaryHtml(plan, profile, { fonts }));
        expect(Buffer.from(planPdf.slice(0, 5)).toString(), id).toBe("%PDF-");
        expect(pageCount(planPdf), id).toBeGreaterThanOrEqual(5);
        expect(pageCount(sumPdf), `${id} summary`).toBeLessThanOrEqual(2);
        // Overflow: lay the document out at A4 print width and look for anything wider than its container.
        const page = await browser.newPage();
        await page.emulateMediaType("print");
        await page.setViewport({ width: 668, height: 1000 });
        await page.setContent(renderPlanHtml(plan, profile, { fonts }), { waitUntil: "load" });
        const wide = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === "visible" && el.clientWidth > 0).map((el) => el.tagName + "." + el.className).slice(0, 5));
        expect(wide, id).toEqual([]);
        await page.close();
      }
    } finally { await browser.close(); }
  }, 120_000);
});
