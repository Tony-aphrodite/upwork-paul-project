/*
 * A client document in Markdown → a branded PDF next to it (logo, Poppins, the brand colours).
 *   CHROME_PATH=/usr/bin/google-chrome npm run doc:pdf -- ../deliverables/Navigator-guide.md
 * The first heading is the title; the line under it (version and date) is shown beneath the title.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";
import { htmlToPdf, closeBrowser } from "../src/doc/pdf";
import { INLINE_FONTS } from "../src/doc/fonts-inline";
import { LOGO_PNG_BASE64 } from "../src/doc/brand-inline";
import { BRAND } from "../src/lib/brand";

const file = process.argv[2];
if (!file?.endsWith(".md")) { console.error("Give the .md file."); process.exit(1); }
const md = readFileSync(file, "utf8");
const title = /^# (.+)$/m.exec(md)?.[1] ?? "Document";
const body = await marked.parse(md.replace(/^(# .+)\n+([^\n]+)\n/m, (_m, heading, meta) => `${heading}\n\n<p class="meta">${meta}</p>\n`), { gfm: true });
const c = BRAND.colors;
const font = (f: string, w: string, style = "normal") => `@font-face { font-family: Poppins; font-weight: ${w}; font-style: ${style}; src: url(data:font/woff2;base64,${INLINE_FONTS[f]}) format('woff2'); }`;
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const html = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${font("poppins-latin-400-normal.woff2", "400")}${font("poppins-latin-400-italic.woff2", "400", "italic")}${font("poppins-latin-500-normal.woff2", "500")}${font("poppins-latin-600-normal.woff2", "600 700")}
@page { size: A4; margin: 18mm 18mm 20mm;
  @bottom-left { content: "${BRAND.name} · ${title.replace(/"/g, "")}"; font: 8pt Poppins, Arial, sans-serif; color: ${c.muted}; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Poppins, Arial, sans-serif; color: ${c.muted}; } }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.5pt/1.5 Poppins, Arial, sans-serif; color: ${c.ink}; }
.logo { width: 52mm; height: auto; display: block; margin-bottom: 9mm; }
h1 { font-weight: 600; color: ${c.brand}; font-size: 24pt; line-height: 1.15; margin: 0; }
.meta { color: ${c.muted}; margin: 2mm 0 0; padding-bottom: 5mm; border-bottom: 1.2mm solid ${c.gold}; width: fit-content; }
h2 { font-weight: 600; color: ${c.brand}; font-size: 14pt; margin: 9mm 0 2.5mm; break-after: avoid; }
h3 { font-weight: 600; color: ${c.brand}; font-size: 11.5pt; margin: 5mm 0 2mm; break-after: avoid; }
p, li { orphans: 3; widows: 3; } p { margin: 0 0 2.5mm; } ul, ol { margin: 0 0 3mm; padding-left: 6mm; } li { margin: 0 0 1mm; }
strong { font-weight: 600; } a { color: ${c.brand}; }
blockquote { margin: 3mm 0; padding: 3mm 5mm; background: ${c.sand}; border-left: 1.2mm solid ${c.gold}; border-radius: 1.5mm; }
blockquote p:last-child { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 9.5pt; break-inside: auto; }
th { text-align: left; font-weight: 600; color: ${c.brand}; background: ${c.brandSoft}; padding: 2mm 2.5mm; }
td { padding: 2mm 2.5mm; border-bottom: 0.3mm solid ${c.line}; vertical-align: top; }
tr { break-inside: avoid; }
</style></head><body><img class="logo" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="${BRAND.name}">${body}</body></html>`;
const pdf = await htmlToPdf(html);
const out = file.replace(/\.md$/, ".pdf");
writeFileSync(out, pdf);
await closeBrowser();
console.log(`Wrote ${out}`);
process.exit(0);
