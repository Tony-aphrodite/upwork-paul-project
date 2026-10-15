/*
 * Import the client's organisations from his Repository sheet (tab "Organisations"), exported as .xlsx:
 *   npm run contacts:import -- Repository.xlsx
 * Writes content/pilot/contacts.json: name, phone, email, website and the areas each serves. His research notes,
 * referral notes and "what we still need" are never imported. His "Status Guide" tab decides which rows are left out:
 * those whose status is one the guide marks "No" for "May be used in Action Plan?" ("Review due", "Superseded / do not
 * use"). Contact details are low-risk background, which the other statuses allow (chatting.md section 31).
 *
 * Which plans show a contact: an optional "Show with actions" column (action keys from the content spreadsheet, or
 * "every plan"; "none" hides it). Without that column, or with the cell empty, the defaults below apply.
 * Every problem is listed and nothing is written until there are none.
 */
import { readFileSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PilotContent } from "../src/lib/pilot/content";
import { Contacts, coverageAreas, parseLinks } from "../src/lib/pilot/contacts";

/** Default links, by organisation name: the plan actions each one helps with (see chatting.md section 31). */
const DEFAULT_LINKS: [RegExp, string][] = [
  [/seniorline/i, "every plan"],
  [/support net/i, "needs-assessment assessment-follow-up support-review more-help-at-home personal-alarm respite funding-pathways residential-assessment"],
  [/tauranga hospital/i, "hospital-discharge after-discharge"],
  [/social work/i, "hospital-discharge"],
  [/district nursing/i, "after-discharge"],
  [/community allied health/i, "after-discharge"],
  [/dementia/i, "memory-gp dementia-support"],
  [/alzheimers/i, "memory-gp dementia-support"],
  [/age concern/i, "social-connection falls driving transport"],
  [/public trust/i, "epoa will"],
  [/total mobility/i, "transport"],
  [/residential subsidy/i, "residential-funding"],
  [/enable new zealand/i, "home-safety"],
  // Stroke Aotearoa and Parkinson's New Zealand: no question asks about stroke or Parkinson's yet, so no default.
];

const file = process.argv[2];
if (!file) { console.error("Give the .xlsx file (the Repository sheet, downloaded as Excel)."); process.exit(1); }
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.getWorksheet("Organisations");
const guide = wb.getWorksheet("Status Guide");
if (!ws || !guide) { console.error('The file needs the "Organisations" and "Status Guide" tabs.'); process.exit(1); }

const text = (v: unknown) => String(v && typeof v === "object" ? ((v as { text?: string; result?: string; hyperlink?: string }).text ?? (v as { result?: string }).result ?? (v as { hyperlink?: string }).hyperlink ?? "") : v ?? "").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rows = (sheet: ExcelJS.Worksheet) => {
  const out: { n: number; v: string[] }[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const raw = (sheet.getRow(n).values as unknown[]).slice(1);
    const v = Array.from({ length: Math.max(sheet.columnCount, raw.length) }, (_, i) => text(raw[i])); // empty cells at the end are missing
    if (v.some(Boolean)) out.push({ n, v });
  }
  return out;
};
const columns = (sheet: ExcelJS.Worksheet) => (sheet.getRow(1).values as unknown[]).slice(1).map((v) => norm(text(v)));
const finder = (header: string[], tab: string) => (name: string, optional = false) => {
  const i = header.indexOf(norm(name));
  if (i < 0 && !optional) throw new Error(`The "${tab}" tab has no "${name}" column.`);
  return i;
};

// The Status Guide: which statuses may be used in an Action Plan.
const g = finder(columns(guide), "Status Guide");
const G = { status: g("Repository status"), use: g("May be used in Action Plan?") };
const guideRows = rows(guide).map(({ v }) => ({ status: norm(v[G.status]), no: /^no\b/i.test(v[G.use]) }));
const barred = guideRows.filter((r) => r.no).map((r) => r.status);
const known = guideRows.map((r) => r.status);

const col = finder(columns(ws), "Organisations");
const C = {
  name: col("Organisation / Service"), coverage: col("Region / Coverage"), website: col("Website"), phone: col("Phone"), email: col("Email"),
  status: col("Repository status"), checked: col("Last checked"), links: col("Show with actions", true),
};

const content = PilotContent.parse(JSON.parse(readFileSync("content/pilot/content.json", "utf8")));
const actionKeys = new Set(content.actions.map((a) => a.key));
const slug = (s: string) => norm(s).replace(/ /g, "-").slice(0, 60).replace(/-+$/, "");
const EMAIL = /^[^\s@;]+@[^\s@;]+\.[a-z]{2,}$/i;

const problems: string[] = [];
const notes: string[] = [];
const contacts = [];
const checked = new Set<string>();
for (const { n, v } of rows(ws)) {
  const name = v[C.name];
  if (!name) { problems.push(`row ${n}: no organisation name`); continue; }
  const status = v[C.status];
  if (barred.some((b) => norm(status).startsWith(b))) { notes.push(`left out (status "${status}"): ${name}`); continue; }
  if (status && !known.includes(norm(status))) notes.push(`status not word for word in the Status Guide, kept: "${status}" (${name})`);
  const { areas, unknown } = coverageAreas(v[C.coverage]);
  if (unknown.length) { problems.push(`row ${n} (${name}): coverage "${v[C.coverage]}" names a place the pilot does not know: ${unknown.join(", ")}`); continue; }
  const website = v[C.website];
  if (website && !/^https?:\/\/\S+$/i.test(website)) { problems.push(`row ${n} (${name}): the website "${website}" does not start with https://`); continue; }
  const emails = v[C.email].split(/\s*;\s*/).filter(Boolean);
  const bad = emails.filter((e) => !EMAIL.test(e));
  if (bad.length) { problems.push(`row ${n} (${name}): not an email address: ${bad.join(", ")}`); continue; }
  if (!v[C.phone] && !emails.length && !website) { notes.push(`left out (no phone, email or website): ${name}`); continue; }
  const own = C.links >= 0 ? v[C.links] : "";
  const linkText = own || DEFAULT_LINKS.find(([re]) => re.test(name))?.[1] || "";
  if (/^none$/i.test(linkText)) { notes.push(`left out ("none" in Show with actions): ${name}`); continue; }
  const links = parseLinks(linkText);
  const unknownKeys = links.actions.filter((k) => !actionKeys.has(k));
  if (unknownKeys.length) { problems.push(`row ${n} (${name}): no action with the key ${unknownKeys.join(", ")} (see the Actions tab of the content spreadsheet)`); continue; }
  if (!links.everyPlan && !links.actions.length) notes.push(`not linked to any action, so never shown: ${name}`);
  const d = v[C.checked].match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (d) checked.add(d);
  contacts.push({ id: slug(name), name, phone: v[C.phone], email: emails.join("; "), website, areas, actions: links.actions, everyPlan: links.everyPlan });
}
const ids = contacts.map((c) => c.id);
for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) problems.push(`two organisations have the same name: ${id}`);
if (!checked.size) problems.push('no "Last Checked" dates found');
if (problems.length) { console.error(`${problems.length} problem(s); nothing was written:\n- ${problems.join("\n- ")}`); process.exit(1); }

const data = Contacts.parse({
  source: "Ageing Navigator's list of organisations",
  checkedOn: [...checked].sort()[0], // the oldest check date, so the plan never claims more than is true
  contacts,
});
writeFileSync("content/pilot/contacts.json", JSON.stringify(data, null, 2) + "\n");
const shown = data.contacts.filter((c) => c.everyPlan || c.actions.length).length;
console.log(`Imported ${data.contacts.length} organisations (checked ${data.checkedOn}); ${shown} are linked to plans.`);
for (const c of data.contacts) console.log(`- ${c.name}: ${c.everyPlan ? "every plan" : c.actions.join(", ") || "not linked"}${c.areas.length ? ` (only ${c.areas.join(", ")})` : ""}`);
if (notes.length) console.log(`Notes:\n- ${notes.join("\n- ")}`);
process.exit(0);
