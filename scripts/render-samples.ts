// Renders both documents for every test case into samples/ (needs CHROME_PATH). Used for review and visual regression checks.
import { writeFileSync } from "node:fs";
import cases from "../content/cases.json";
import { FamilyProfile } from "../src/lib/schema";
import { builtInLibrary } from "../src/lib/library";
import { generatePlan } from "../src/lib/engine/generate";
import { renderPlanHtml, renderSummaryHtml } from "../src/doc/templates";
import { INLINE_FONTS } from "../src/doc/fonts-inline";
import { closeBrowser, htmlToPdf, pageCount } from "../src/doc/pdf";

async function main() {
  const fonts = { kind: "inline" as const, files: INLINE_FONTS };
  for (const c of cases) {
    const profile = FamilyProfile.parse(c.profile);
    const plan = generatePlan(profile, builtInLibrary, { now: new Date("2026-09-22T09:00:00Z"), planId: `AP-${c.profile.profileId.slice(3)}` });
    const a = await htmlToPdf(renderPlanHtml(plan, profile, { fonts }));
    const s = await htmlToPdf(renderSummaryHtml(plan, profile, { fonts }));
    writeFileSync(`samples/${c.id}-action-plan.pdf`, a);
    writeFileSync(`samples/${c.id}-professional-summary.pdf`, s);
    console.log(`${c.id}: plan ${pageCount(a)} pages, summary ${pageCount(s)} page(s)`);
  }
  await closeBrowser();
}
main();
