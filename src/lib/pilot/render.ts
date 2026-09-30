import { BRAND } from "../brand";
import { PRIORITY_LABEL } from "../priority";
import { fmtDate } from "../text";
import { nzLongDate } from "../format";
import { citedSources, liveActions, liveInformation, livePathways, thingsToCheck, type PilotPlan } from "./plan";

/**
 * One renderer for the family's page, the navigator's preview and the PDF. Pure string building, all text escaped,
 * and any section with nothing to say is left out. The web page gets `renderPlanSections` inside `.anplan`; the PDF
 * gets `renderPlanDocument`, which adds a cover and paged-media rules to the same sections.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const when = (cond: unknown, html: () => string) => (cond ? html() : "");
const ul = (xs: string[], cls = "") => (xs.length ? `<ul${cls ? ` class="${cls}"` : ""}>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
/** A paragraph, or nothing when the text is empty (a navigator may clear a text). */
const para = (s: string, cls = "") => (s.trim() ? `<p${cls ? ` class="${cls}"` : ""}>${esc(s)}</p>` : "");
/** Text inside a CSS string (the PDF footer): HTML entities are not decoded there, so escape for CSS instead. */
const cssString = (s: string) => s.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, " ").replace(/</g, "\\3C ");

export type SectionOptions = {
  /** On the web page: where the family asks for help (the form's anchor). The PDF carries no link. */
  requestHref?: string;
  mode: "web" | "pdf";
  /** How the PDF tells people to get in touch (it has no link, so a forwarded PDF opens nothing). */
  contact?: string;
};

export function renderPlanSections(plan: PilotPlan, opts: SectionOptions): string {
  const actions = liveActions(plan);
  const sources = citedSources(plan);
  const srcNo = new Map(sources.map((s, i) => [s.id, i + 1]));
  const ref = (id?: string) => (id && srcNo.has(id) ? ` <span class="ref">[${srcNo.get(id)}]</span>` : "");
  const info = (section: "funding" | "check" | "professional") =>
    liveInformation(plan, section).map((i) => `<div class="info">${when(i.title, () => `<h4>${esc(i.title)}</h4>`)}<p>${esc(i.text)}${ref(i.sourceId)}</p></div>`).join("");
  const checks = thingsToCheck(plan);
  const checkInfo = liveInformation(plan, "check");

  const parts: string[] = [];

  if (plan.intro.trim()) parts.push(`<section class="intro">${para(plan.intro)}</section>`);

  if (plan.urgent) parts.push(`
    <section class="urgent" aria-labelledby="urgent-h">
      <h2 id="urgent-h">Things that may need urgent attention</h2>
      ${ul(plan.urgent.items)}
      ${para(plan.urgent.guidance, "guidance")}
    </section>`);

  if (plan.situation.length) parts.push(`<section><h2>Your current situation</h2>${ul(plan.situation, "plain")}</section>`);
  if (plan.matters.length) parts.push(`<section><h2>What matters most</h2>${ul(plan.matters, "plain")}</section>`);

  const pathways = livePathways(plan);
  const pathwayBody = pathways.length
    ? pathways.map((p) => `<div class="pathway"><h3>${esc(p.name)}</h3>${para(p.explanation)}</div>`).join("")
    : para(plan.pathwayNote);
  if (pathwayBody) parts.push(`<section><h2>${pathways.length > 1 ? "Pathways to explore" : "Your likely pathway"}</h2>${pathwayBody}</section>`);

  if (actions.length) parts.push(`
    <section>
      <h2>Your priority actions</h2>
      ${actions.map((a, n) => `
        <article class="action ${a.priority}">
          <header><span class="num">${n + 1}</span><div><span class="chip ${a.priority}">${PRIORITY_LABEL[a.priority]}</span>${when(a.topic, () => ` <span class="topic">${esc(a.topic)}</span>`)}<h3>${esc(a.title)}${ref(a.sourceId)}</h3></div></header>
          <dl>
            ${when(a.why, () => `<dt>Why it matters</dt><dd>${esc(a.why)}</dd>`)}
            ${when(a.nextStep, () => `<dt>Next step</dt><dd>${esc(a.nextStep)}</dd>`)}
            ${when(a.whoCanHelp.length, () => `<dt>Who can help</dt><dd>${esc(a.whoCanHelp.join(", "))}</dd>`)}
            ${when(a.prepare.length, () => `<dt>What to prepare</dt><dd>${ul(a.prepare)}</dd>`)}
            ${when(a.questions.length, () => `<dt>Questions to ask</dt><dd>${ul(a.questions)}</dd>`)}
          </dl>
        </article>`).join("")}
    </section>`);

  const funding = info("funding");
  if (funding) parts.push(`<section><h2>Funding and assessment information</h2>${funding}</section>`);

  if (checks.length || checkInfo.length) parts.push(`
    <section>
      <h2>Things to check</h2>
      ${when(checks.length, () => `<ul class="todo">${checks.map((c) => `<li><span class="tick" aria-hidden="true"></span><span>${esc(c.text)}${when(c.from, () => ` <span class="meta">· ${esc(c.from)}</span>`)}</span></li>`).join("")}</ul>`)}
      ${info("check")}
    </section>`);

  const professional = info("professional");
  if (professional) parts.push(`<section><h2>Professional assessment and advice</h2>${professional}</section>`);

  parts.push(`
    <section class="support">
      <h2>Help from ${esc(BRAND.name)}</h2>
      ${para(plan.cta)}
      ${ul(plan.services.map((s) => s.label))}
      ${opts.mode === "web" && opts.requestHref
        ? `<p><a class="button" href="${esc(opts.requestHref)}">Ask for help with this plan</a></p>`
        : para(opts.contact ?? `To ask for help, use the link in your email, or contact us on ${BRAND.phone} or ${BRAND.email}.`)}
    </section>`);

  if (sources.length) parts.push(`
    <section>
      <h2>Sources</h2>
      <ol class="sources">${sources.map((s) => `<li>${esc(s.title)}${when(s.publisher, () => `, ${esc(s.publisher)}`)}. <a href="${esc(s.url)}">${esc(s.url)}</a> (checked ${esc(fmtDate(s.lastChecked))})</li>`).join("")}</ol>
    </section>`);

  if (plan.disclaimer.trim()) parts.push(`<section class="disclaimer">${para(plan.disclaimer)}</section>`);
  return parts.join("\n");
}

/* ------------------------------ styles ------------------------------ */

const c = BRAND.colors;
/** Shared by the web page (scoped under .anplan) and the PDF. Priority is shown in words as well as colour. */
export const PLAN_CSS = (scope: string) => `
${scope} { color: ${c.ink}; overflow-wrap: anywhere; }
${scope} h2 { font-family: var(--ff-display, Literata), Georgia, serif; font-weight: 600; color: ${c.brand}; font-size: 1.35em; line-height: 1.2; margin: 0 0 .6em; break-after: avoid; }
${scope} h3 { font-family: var(--ff-display, Literata), Georgia, serif; font-weight: 600; color: ${c.brand}; font-size: 1.08em; line-height: 1.25; margin: .15em 0 .4em; break-after: avoid; }
${scope} h4 { font-size: .8em; text-transform: uppercase; letter-spacing: .06em; color: ${c.muted}; margin: 0 0 .3em; }
${scope} p { margin: 0 0 .6em; }
${scope} section { margin: 0 0 1.8em; }
${scope} ul { margin: 0 0 .6em; padding-left: 1.2em; } ${scope} li { margin: 0 0 .25em; }
${scope} ul.plain { list-style: none; padding: 0; } ${scope} ul.plain li { padding: .35em 0; border-bottom: 1px solid ${c.line}; }
${scope} a { color: ${c.brand}; }
${scope} .intro p { font-size: 1.05em; }
${scope} .urgent { border: 3px solid ${c.now}; border-radius: 10px; padding: 1em 1.2em; break-inside: avoid; }
${scope} .urgent h2 { color: ${c.now}; }
${scope} .urgent .guidance { background: ${c.nowSoft}; border-radius: 6px; padding: .7em .9em; font-weight: 700; margin: .6em 0 0; }
${scope} .pathway { background: ${c.brandSoft}; border-radius: 8px; padding: .9em 1.1em; margin-bottom: .6em; break-inside: avoid; }
${scope} .action { border-left: 4px solid ${c.line}; padding: .2em 0 .4em 1em; margin: 0 0 1.2em; break-inside: avoid; }
${scope} .action.now { border-color: ${c.now}; } ${scope} .action.soon { border-color: ${c.soon}; } ${scope} .action.plan_ahead { border-color: ${c.ahead}; }
${scope} .action header { display: flex; gap: .8em; align-items: flex-start; }
${scope} .num { font-family: var(--ff-display, Literata), Georgia, serif; font-size: 1.5em; line-height: 1; color: ${c.brand}; min-width: 1.2em; }
${scope} .chip { display: inline-block; padding: .1em .6em; border-radius: 99px; font-size: .78em; font-weight: 700; }
${scope} .chip.now { background: ${c.nowSoft}; color: ${c.now}; } ${scope} .chip.soon { background: ${c.soonSoft}; color: ${c.soon}; } ${scope} .chip.plan_ahead { background: ${c.aheadSoft}; color: ${c.ahead}; }
${scope} .topic { font-size: .82em; color: ${c.muted}; }
${scope} .action dl { margin: .3em 0 0 2em; display: grid; grid-template-columns: minmax(7.5em, 10em) 1fr; gap: .25em 1em; }
${scope} .action dt { font-weight: 700; color: ${c.muted}; font-size: .9em; }
${scope} .action dd { margin: 0; } ${scope} .action dd ul { margin: 0; }
${scope} .info { background: ${c.sand}; border-radius: 6px; padding: .7em .9em; margin-bottom: .6em; break-inside: avoid; }
${scope} .todo { list-style: none; padding: 0; } ${scope} .todo li { display: grid; grid-template-columns: 1.4em 1fr; gap: .2em; margin-bottom: .45em; break-inside: avoid; }
${scope} .tick { width: .9em; height: .9em; border: 1.5px solid ${c.brand}; border-radius: 3px; margin-top: .2em; }
${scope} .meta, ${scope} .ref { color: ${c.muted}; font-size: .85em; }
${scope} .support { background: ${c.brandSoft}; border-radius: 10px; padding: 1em 1.2em; break-inside: avoid; }
${scope} .button { display: inline-block; background: ${c.brand}; color: #fff; text-decoration: none; font-weight: 700; padding: .6em 1.1em; border-radius: 8px; }
${scope} .sources li { font-size: .88em; }
${scope} .disclaimer { font-size: .85em; color: ${c.muted}; border-top: 1px solid ${c.line}; padding-top: 1em; }
@media (max-width: 560px) { ${scope} .action dl { grid-template-columns: 1fr; margin-left: 0; } ${scope} .action dd { margin-bottom: .4em; } }
`;

/* ------------------------------ the PDF ------------------------------ */

export type FontSource = { kind: "inline"; files: Record<string, string> } | { kind: "url"; base: string };

function fontFaces(src: FontSource) {
  const url = (f: string) => (src.kind === "url" ? `url('${src.base}/${f}') format('woff2')` : `url(data:font/woff2;base64,${src.files[f]}) format('woff2')`);
  return `
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 400; src: ${url("atkinson-hyperlegible-latin-400-normal.woff2")}; }
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 700; src: ${url("atkinson-hyperlegible-latin-700-normal.woff2")}; }
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 400; font-style: italic; src: ${url("atkinson-hyperlegible-latin-400-italic.woff2")}; }
@font-face { font-family: "Literata"; font-weight: 300 800; src: ${url("literata-latin-wght-normal.woff2")}; }`;
}

export type DocumentOptions = { fonts: FontSource; issuedOn: Date; reference: string; coverNote: string; watermark?: string };

export function renderPlanDocument(plan: PilotPlan, opts: DocumentOptions): string {
  const footer = cssString(`${BRAND.name} · ${plan.personName} · ${opts.reference}`);
  const css = `
${fontFaces(opts.fonts)}
@page { size: A4; margin: 18mm 17mm 20mm;
  @bottom-left { content: "${footer}"; font: 8pt "Atkinson Hyperlegible", sans-serif; color: ${c.muted}; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt "Atkinson Hyperlegible", sans-serif; color: ${c.muted}; } }
@page cover { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.5pt/1.5 "Atkinson Hyperlegible", Arial, sans-serif; --ff-display: Literata; }
.cover { page: cover; height: 297mm; padding: 26mm 22mm; display: flex; flex-direction: column; background: ${c.sand}; break-after: page; }
.cover .brand { display: flex; align-items: center; gap: 3mm; font-weight: 700; color: ${c.brand}; font-size: 13pt; }
.cover h1 { font-family: Literata, Georgia, serif; font-weight: 600; color: ${c.brand}; font-size: 32pt; line-height: 1.15; margin: 60mm 0 0; }
.cover .for { margin-top: 8mm; font-size: 15pt; }
.cover dl { margin-top: auto; display: grid; grid-template-columns: 40mm 1fr; gap: 2mm 6mm; font-size: 10.5pt; }
.cover dt { color: ${c.muted}; } .cover dd { margin: 0; font-weight: 700; }
.cover .note { margin-top: 8mm; font-size: 9pt; color: ${c.muted}; border-top: 1px solid #D9CFBF; padding-top: 4mm; }
.watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 40pt; color: rgba(162, 59, 44, .13); transform: rotate(-24deg); font-weight: 700; }
${PLAN_CSS(".plan")}`;
  const cover = `
  <div class="cover">
    <div class="brand">${BRAND.logoSvg(40)}<span>${esc(BRAND.name)}</span></div>
    <h1>${esc(BRAND.planTitle)}</h1>
    <p class="for">For ${esc(plan.personName)}</p>
    <dl>
      <dt>Prepared for</dt><dd>${esc(plan.preparedFor)}</dd>
      <dt>Date</dt><dd>${esc(nzLongDate(opts.issuedOn))}</dd>
      <dt>Reference</dt><dd>${esc(opts.reference)}</dd>
    </dl>
    ${para(opts.coverNote, "note")}
  </div>`;
  return `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><title>${esc(BRAND.planTitle)} · ${esc(plan.personName)}</title><style>${css}</style></head>
<body>${when(opts.watermark, () => `<div class="watermark">${esc(opts.watermark)}</div>`)}${cover}<main class="plan">${renderPlanSections(plan, { mode: "pdf" })}</main></body></html>`;
}
