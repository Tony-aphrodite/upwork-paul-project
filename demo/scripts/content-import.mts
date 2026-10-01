/*
 * Import the content spreadsheet: npm run content:import -- file.xlsx [--version 2026-10-05.1] [--production]
 * Every problem is listed with its tab, row and column, and nothing is written until there are none.
 * --production refuses a spreadsheet with rows still marked Draft.
 */
import { writeFileSync } from "node:fs";
import { args } from "./lib/args";
import { readWorkbook } from "./lib/xlsx";
import { compileContent, ContentError } from "../src/lib/pilot/sheet";

const { flags, rest } = args();
if (!rest[0]) { console.error("Give the .xlsx file to import."); process.exit(1); }
const now = new Date();
const version = typeof flags.version === "string" ? flags.version : `${now.toISOString().slice(0, 10)}.${now.getUTCHours()}${String(now.getUTCMinutes()).padStart(2, "0")}`;
try {
  const content = compileContent(await readWorkbook(rest[0]), { version });
  if (flags.production && content.status !== "approved") {
    console.error("Some rows are still marked Draft. Approve every row before a production import, or import without --production for testing.");
    process.exit(1);
  }
  writeFileSync("content/pilot/content.json", JSON.stringify(content, null, 2) + "\n");
  const qs = content.questionnaire.sections.flatMap((s) => s.questions).length;
  console.log(`Imported content ${version} (${content.status}): ${qs} questions, ${content.actions.length} actions, ${content.information.length} information rows.`);
  console.log("Next: npm test, then deploy. Existing cases keep their plans; use Regenerate on a case to rebuild it with the new wording.");
} catch (e) {
  if (e instanceof ContentError) {
    console.error(`The spreadsheet has ${e.problems.length} problem${e.problems.length === 1 ? "" : "s"}; nothing was imported:`);
    for (const p of e.problems) console.error(`- ${p.tab}${p.row ? `, row ${p.row}` : ""}${p.column ? `, ${p.column}` : ""}: ${p.message}`);
    process.exit(1);
  }
  throw e;
}
