import ExcelJS from "exceljs";
import { TABS, UNSURE_LABEL, type Rows } from "../../src/lib/pilot/sheet";

/** Reading and writing the content spreadsheet. The layout (tabs and headers) comes from TABS in sheet.ts. */

const HOW_TO = [
  ["Ageing Navigator content spreadsheet"],
  [""],
  ["Each tab holds one kind of content. Change the text in the cells; keep the column headers as they are."],
  ["Rows marked Draft are for testing only. Mark a row Approved once you are happy with its wording; real families only see approved content."],
  [""],
  ["SHOW WHEN: when a question, pathway, sentence, action or piece of information applies"],
  ["Leave it empty to show it always. Otherwise write a condition using question IDs and option values from the Questions tab:"],
  ["q8 has falls", "a multiple-choice answer includes this option"],
  ["q8 has any falls, transport", "includes at least one of these"],
  ["q8 has all falls, transport", "includes every one of these"],
  ["q19 is completed", "a single-choice answer is this option"],
  ["q19 is not completed", ""],
  ["q19 in completed, receiving", "is one of these"],
  ["q19 not in none, unsure", "is none of these"],
  ["q21.epoa_property is no", "one row of a grid question"],
  ["q11a answered", "any answer at all (use \"not answered\" for none)"],
  ["Combine with and, or, not, and brackets:", "(q6 is alone or q6 is with_partner) and q18 is yes"],
  ["A question's Show when can only use questions asked before it."],
  [""],
  ["PLACEHOLDERS in wording"],
  ["{{name}}", "the name the older person likes to be called"],
  ["{{answer.q12}}", "the options chosen for a choice question, e.g. \"housework and shopping\". Free-text answers cannot be placed in wording."],
  ["A sentence whose placeholder has nothing to fill is left out of the plan."],
  [""],
  ["OPTIONS", "one per line, as value = Label. The value is what conditions use: lower-case letters, numbers and underscores."],
  ["Unsure answers", `add any of: ${Object.values(UNSURE_LABEL).join(", ")}. They are added to the options and cannot be combined with other answers.`],
  ["Exclusive options", "values that cannot be combined with other answers, such as none_of_these."],
  ["Lists", "Who can help, What to prepare, Questions to ask and Things to check take one item per line."],
  [""],
  ["When you are done, send the file back. It is checked automatically and any problem is reported with its tab, row and column."],
];

const WIDTH: Record<string, number> = { Question: 48, Options: 44, Text: 70, Explanation: 60, "What to do": 40, "Why it matters": 44, "Next step": 44, "Who can help": 28, "What to prepare": 32, "Questions to ask": 40, "Things to check": 36, "Show when": 44, Intro: 50, Title: 30, Help: 36, URL: 40, Value: 40, Label: 36, Notes: 30 };
const LISTS: Record<string, string[]> = {
  Type: ["Single choice", "Multiple choice", "Short text", "Long text", "Grid"],
  Priority: ["Now", "Soon", "Plan ahead"],
  Status: ["Draft", "Approved"],
  Required: ["yes", "no"],
};

export async function writeWorkbook(rows: Rows, file: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ageing Navigator";
  const how = wb.addWorksheet("How to use");
  HOW_TO.forEach((r) => how.addRow(r));
  how.getColumn(1).width = 42; how.getColumn(2).width = 90;
  how.getRow(1).font = { bold: true, size: 14 };
  for (const r of [6, 20]) how.getRow(r).font = { bold: true };

  for (const tab of Object.values(TABS)) {
    const ws = wb.addWorksheet(tab.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = tab.columns.map((c) => ({ header: c, key: c, width: WIDTH[c] ?? 18 }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E5F" } };
    for (const r of rows[tab.name] ?? []) ws.addRow(Object.fromEntries(tab.columns.map((c) => [c, r[c] ?? ""])));
    ws.eachRow((row, n) => { if (n > 1) row.alignment = { wrapText: true, vertical: "top" }; });
    // Drop-down lists for the fixed-choice columns, on the existing rows and room for new ones. The limit is fixed
    // first: creating cells grows rowCount, so it must not be re-read inside the loop.
    const lastRow = Math.max(200, ws.rowCount + 50);
    tab.columns.forEach((c, i) => {
      const list = LISTS[c];
      if (!list) return;
      const col = ws.getColumn(i + 1).letter;
      for (let r = 2; r <= lastRow; r++) ws.getCell(`${col}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${list.join(",")}"`] };
    });
  }
  await wb.xlsx.writeFile(file);
}

function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("hyperlink" in v) return String(v.hyperlink);
    if ("result" in v) return v.result == null ? "" : String(v.result);
    return "";
  }
  return String(v);
}

export async function readWorkbook(file: string): Promise<Rows> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rows: Rows = {};
  for (const tab of Object.values(TABS)) {
    const ws = wb.getWorksheet(tab.name);
    if (!ws) continue;
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = text(cell.value).trim(); });
    const list: Record<string, string>[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const rec: Record<string, string> = {};
      headers.forEach((h, col) => { if (h) rec[h] = text(row.getCell(col).value); });
      if (Object.values(rec).some((v) => v.trim())) list.push(rec);
    });
    rows[tab.name] = list;
  }
  return rows;
}
