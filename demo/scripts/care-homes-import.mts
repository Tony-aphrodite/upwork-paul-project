/*
 * Import the client's care homes from his Repository sheet (tab "BOP Care Homes"), exported as .xlsx:
 *   npm run care-homes:import -- Repository.xlsx
 * Writes content/pilot/care-homes.json. Only certified homes, and only public facts: name, operator, place, levels of
 * care, respite and village on site, contact. Prices, vacancies and his verification notes are never imported.
 * Every problem is listed and nothing is written until there are none.
 */
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { AREAS, CareHomes, type CareLevel } from "../src/lib/pilot/care-homes";

const file = process.argv[2];
if (!file) { console.error("Give the .xlsx file (the Repository sheet, downloaded as Excel)."); process.exit(1); }
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.getWorksheet("BOP Care Homes");
if (!ws) { console.error('The file has no "BOP Care Homes" tab.'); process.exit(1); }

const text = (v: unknown) => String(v && typeof v === "object" ? ((v as { text?: string; result?: string; hyperlink?: string }).text ?? (v as { result?: string }).result ?? (v as { hyperlink?: string }).hyperlink ?? "") : v ?? "").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const header = (ws.getRow(1).values as unknown[]).slice(1).map((v) => norm(text(v)));
const col = (name: string) => { const i = header.indexOf(norm(name)); if (i < 0) throw new Error(`The tab has no "${name}" column.`); return i; };
const C = {
  name: col("Facility"), operator: col("Operator"), district: col("District"), locality: col("Locality"), address: col("Address"),
  rest: col("Rest Home"), hospital: col("Hospital"), dementia: col("Dementia"), psycho: col("Psychogeriatric"),
  respite: col("Respite / Short Stay"), village: col("Retirement Village On-site"), contact: col("Website / Contact"),
  certified: col("Certification Status"), checked: col("Last Checked"),
};
const areaOf = new Map(Object.entries(AREAS).map(([k, a]) => [norm(a.district), k]));
const yes = (s: string) => /^(yes|y|true)\b/i.test(s);
const slug = (s: string) => norm(s).replace(/ /g, "-").slice(0, 60);

const problems: string[] = [];
const homes = [];
const checked = new Set<string>();
for (let n = 2; n <= ws.rowCount; n++) {
  const v = (ws.getRow(n).values as unknown[]).slice(1).map(text);
  if (!v.some(Boolean)) continue;
  const name = v[C.name];
  if (!name) { problems.push(`row ${n}: no facility name`); continue; }
  if (!/^certified/i.test(v[C.certified])) continue; // only homes on the Ministry of Health's certified list
  const area = areaOf.get(norm(v[C.district]));
  if (!area) { problems.push(`row ${n} (${name}): district "${v[C.district]}" is not one of ${Object.values(AREAS).map((a) => a.district).join(", ")}`); continue; }
  const levels = ([["rest_home", C.rest], ["hospital", C.hospital], ["dementia", C.dementia], ["psychogeriatric", C.psycho]] as [CareLevel, number][])
    .filter(([, i]) => yes(v[i])).map(([l]) => l);
  if (!levels.length) { problems.push(`row ${n} (${name}): no level of care marked Yes`); continue; }
  const d = v[C.checked].match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (d) checked.add(d);
  homes.push({ id: slug(name), name, operator: v[C.operator], area, locality: v[C.locality], address: v[C.address], levels,
    respite: yes(v[C.respite]), villageOnSite: yes(v[C.village]), contact: v[C.contact] });
}
const ids = homes.map((h) => h.id);
for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) problems.push(`two homes have the same name: ${id}`);
if (!checked.size) problems.push('no "Last Checked" dates found');
if (problems.length) { console.error(`${problems.length} problem(s); nothing was written:\n- ${problems.join("\n- ")}`); process.exit(1); }

const data = CareHomes.parse({
  source: "the Ministry of Health's list of certified providers, with the care each home offers from its own website",
  checkedOn: [...checked].sort()[0], // the oldest check date, so the plan never claims more than is true
  homes: homes.sort((a, b) => a.name.localeCompare(b.name)),
});
writeFileSync("content/pilot/care-homes.json", JSON.stringify(data, null, 2) + "\n");
const by = (k: keyof typeof AREAS) => data.homes.filter((h) => h.area === k).length;
console.log(`Imported ${data.homes.length} certified care homes (checked ${data.checkedOn}): ${Object.keys(AREAS).map((k) => `${AREAS[k].district} ${by(k)}`).join(", ")}.`);
process.exit(0);
