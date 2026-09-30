/* Write the current content to a spreadsheet for the Ageing Navigator team: npm run content:export -- [file.xlsx] */
import { args } from "./lib/args";
import { writeWorkbook } from "./lib/xlsx";
import { contentToRows } from "../src/lib/pilot/sheet";
import { content } from "../src/lib/pilot/library";

const { rest } = args();
const file = rest[0] ?? `ageing-navigator-content-${content.version}.xlsx`;
await writeWorkbook(contentToRows(content), file);
console.log(`Wrote ${file} (content ${content.version}, ${content.status}).`);
