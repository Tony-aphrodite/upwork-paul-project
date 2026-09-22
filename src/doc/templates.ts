import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, type Action, type ActionPlan, type FamilyProfile, type Priority } from "../lib/schema";
import { fmtDate } from "../lib/engine/context";

/**
 * Structured data → HTML/CSS → PDF. These functions are pure (no Node or React), so the same template
 * renders the in-browser preview and the server PDF, and a future backend in another language can call it through the API.
 * All text is escaped; sections with nothing to say are left out rather than printed empty.
 */

export const BRAND = { name: "Kinfield Navigator", phone: "0123456789", email: "plans@kinfield.example", site: "kinfield.example" };

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const when = (cond: unknown, html: () => string) => (cond ? html() : "");

export const LOGO = `<svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#1F4E5F"/><path d="M9 30c7 0 6-9 12-9s6-8 10-8" stroke="#F4EBDD" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="31" cy="13" r="3.4" fill="#E0A458"/><circle cx="9" cy="30" r="2.3" fill="#F4EBDD"/></svg>`;

export type FontSource = { kind: "url"; base: string } | { kind: "inline"; files: Record<string, string> };

function fontFaces(src: FontSource) {
  const url = (f: string) => (src.kind === "url" ? `url('${src.base}/${f}') format('woff2')` : `url(data:font/woff2;base64,${src.files[f]}) format('woff2')`);
  return `
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 400; font-style: normal; src: ${url("atkinson-hyperlegible-latin-400-normal.woff2")}; }
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 700; font-style: normal; src: ${url("atkinson-hyperlegible-latin-700-normal.woff2")}; }
@font-face { font-family: "Atkinson Hyperlegible"; font-weight: 400; font-style: italic; src: ${url("atkinson-hyperlegible-latin-400-italic.woff2")}; }
@font-face { font-family: "Literata"; font-weight: 300 800; src: ${url("literata-latin-wght-normal.woff2")}; }`;
}

/* One stylesheet for both documents. Colours meet WCAG AA on white; priority is shown by label as well as colour, so it survives black-and-white printing. */
const CSS = (footerLeft: string, compact: boolean) => `
:root { --ink: #1B2A30; --muted: #4F5F66; --line: #D8DEE0; --brand: #1F4E5F; --brand-soft: #E7EFF1; --sand: #F6F1E8; --now: #A23B2C; --now-soft: #F8E9E6; --soon: #8A5A10; --soon-soft: #F7EEDC; --ahead: #2D6A55; --ahead-soft: #E5F1EC; }
@page { size: A4; margin: 18mm 17mm 20mm;
  @bottom-left { content: "${footerLeft}"; font: 8pt "Atkinson Hyperlegible", sans-serif; color: #4F5F66; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt "Atkinson Hyperlegible", sans-serif; color: #4F5F66; } }
@page cover { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: ${compact ? "9.6pt/1.42" : "11pt/1.5"} "Atkinson Hyperlegible", Arial, sans-serif; color: var(--ink); overflow-wrap: anywhere; hyphens: auto; }
h1, h2, h3 { font-family: Literata, Georgia, serif; font-weight: 600; color: var(--brand); line-height: 1.2; margin: 0; break-after: avoid; }
h2 { font-size: ${compact ? "13pt" : "19pt"}; margin: 0 0 ${compact ? "2mm" : "4mm"}; }
h3 { font-size: ${compact ? "10.5pt" : "13pt"}; margin: 5mm 0 2mm; }
h4 { font-size: 10pt; margin: 4mm 0 1.5mm; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); break-after: avoid; }
p { margin: 0 0 2.5mm; }
ul { margin: 0 0 3mm; padding-left: 5mm; } li { margin: 0 0 1.2mm; }
a { color: var(--brand); }
section { margin: 0 0 8mm; }
.page-break { break-before: page; }
.chip { display: inline-block; padding: .6mm 2.4mm; border-radius: 99px; font-size: 8.5pt; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.chip.now { background: var(--now-soft); color: var(--now); } .chip.soon { background: var(--soon-soft); color: var(--soon); } .chip.plan_ahead { background: var(--ahead-soft); color: var(--ahead); }
.muted { color: var(--muted); } .small { font-size: 9pt; }
/* cover */
.cover { page: cover; height: 297mm; padding: 26mm 22mm; display: flex; flex-direction: column; background: var(--sand); }
.brand { display: flex; align-items: center; gap: 3mm; font-weight: 700; color: var(--brand); font-size: 12pt; }
.cover h1 { font-size: 34pt; margin-top: 58mm; max-width: 150mm; }
.cover .for { margin-top: 8mm; font-size: 14pt; }
.cover dl { margin-top: auto; display: grid; grid-template-columns: 38mm 1fr; gap: 2mm 6mm; font-size: 10.5pt; }
.cover dt { color: var(--muted); } .cover dd { margin: 0; font-weight: 700; }
.cover .conf { margin-top: 8mm; font-size: 9pt; color: var(--muted); border-top: 1px solid #D9CFBF; padding-top: 4mm; }
/* glance */
.glance { display: grid; grid-template-columns: 1.25fr 1fr; gap: 5mm; }
.box { border: 1px solid var(--line); border-radius: 3mm; padding: 4mm 5mm; break-inside: avoid; }
.box.next { grid-column: 1 / -1; background: var(--brand); color: #fff; border: 0; }
.box.next .label { color: #CFE0E5; } .box.next .big { font-family: Literata, Georgia, serif; font-size: 15pt; margin-top: 1.5mm; }
.label { font-size: 8.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 2mm; }
.plist { list-style: none; padding: 0; margin: 0; } .plist li { display: flex; gap: 2.5mm; align-items: baseline; margin-bottom: 1.8mm; }
.priority { display: grid; grid-template-columns: 9mm 1fr; gap: 3mm; border-left: 1.2mm solid var(--line); padding: 3mm 0 3mm 4mm; margin-bottom: 3mm; break-inside: avoid; }
.priority.now { border-color: var(--now); } .priority.soon { border-color: var(--soon); } .priority.plan_ahead { border-color: var(--ahead); }
.num { font-family: Literata, Georgia, serif; font-size: 18pt; color: var(--brand); line-height: 1; }
/* tables */
table { width: 100%; border-collapse: collapse; font-size: ${compact ? "9pt" : "10pt"}; }
thead { display: table-header-group; }
th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-bottom: 1.5px solid var(--brand); padding: 1.8mm 2mm; }
td { border-bottom: 1px solid var(--line); padding: 2mm; vertical-align: top; }
tr { break-inside: avoid; }
tr.group td { background: var(--brand-soft); font-weight: 700; color: var(--brand); padding-top: 2.2mm; }
/* modules */
.module { break-before: auto; margin-bottom: 9mm; }
.module-head { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; border-bottom: 1.5px solid var(--brand); padding-bottom: 1.5mm; margin-bottom: 3mm; break-after: avoid; }
.module-head h3 { margin: 0; }
.todo { list-style: none; padding: 0; } .todo li { display: grid; grid-template-columns: 6mm 1fr; gap: 1mm; break-inside: avoid; margin-bottom: 2mm; }
.tick { width: 4mm; height: 4mm; border: 1.3px solid var(--brand); border-radius: 1mm; margin-top: .8mm; position: relative; }
.tick.done::after { content: ""; position: absolute; left: 1.1mm; top: .2mm; width: 1.2mm; height: 2.4mm; border: solid var(--brand); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
.meta { font-size: 9pt; color: var(--muted); }
.info { background: var(--sand); border-radius: 2mm; padding: 3mm 4mm; margin-bottom: 2.5mm; break-inside: avoid; }
.match { border: 1px solid var(--line); border-radius: 2mm; padding: 3mm 4mm; margin-bottom: 2.5mm; break-inside: avoid; }
.match b { color: var(--brand); } .yes { color: var(--ahead); } .no { color: var(--now); }
.two { columns: 2; column-gap: 8mm; } .two > * { break-inside: avoid; }
.support { background: var(--brand-soft); border-radius: 3mm; padding: 5mm 6mm; break-inside: avoid; }
.urgent { border: 1.2mm solid var(--now); border-radius: 3mm; padding: 4mm 5mm; margin-bottom: 6mm; break-inside: avoid; }
.urgent h2 { color: var(--now); border: 0; margin: 0 0 2mm; }
.urgent .guidance { background: var(--now-soft, #F8E9E6); border-radius: 2mm; padding: 3mm 4mm; margin-top: 3mm; font-weight: 600; }
.sources li { font-size: 9pt; }
/* On screen (the admin preview) show the document as sheets; print and PDF ignore this block. */
@media screen {
  html { background: #E4E8E9; }
  body { width: 210mm; margin: 6mm auto; padding: 18mm 17mm; background: #fff; box-shadow: 0 2px 14px rgb(0 0 0 / .12); }
  .cover { margin: -18mm -17mm 12mm; height: 297mm; }
  .page-break { border-top: 1px dashed #B8C4C8; padding-top: 10mm; margin-top: 10mm; }
}
/* professional summary */
.sum-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; border-bottom: 2px solid var(--brand); padding-bottom: 3mm; margin-bottom: 4mm; }
.sum-head h1 { font-size: 17pt; }
.facts { width: 100%; }
.facts tr.flagged th, .facts tr.flagged td { background: var(--now-soft); color: var(--now); font-weight: 700; }
.facts th { width: 44mm; text-transform: none; letter-spacing: 0; font-size: 9pt; color: var(--brand); border-bottom: 1px solid var(--line); vertical-align: top; }
.facts td ul { margin: 0; padding-left: 4mm; } .facts td li { margin: 0 0 .6mm; }
`;

const doc = (title: string, body: string, fonts: FontSource, footerLeft: string, compact = false) =>
  `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${fontFaces(fonts)}${CSS(footerLeft.replace(/"/g, "'"), compact)}</style></head><body>${body}</body></html>`;

const chip = (p: Priority) => `<span class="chip ${p}">${PRIORITY_LABEL[p]}</span>`;
const byPriority = (actions: Action[]) => PRIORITIES.map((p) => [p, actions.filter((a) => a.priority === p)] as const).filter(([, xs]) => xs.length);
const open = (a: Action) => a.status !== "completed" && a.status !== "no_longer_required";

export type RenderOptions = { fonts: FontSource; generatedAt?: string };

/* ------------------------------ Family Action Plan ------------------------------ */

export function renderPlanHtml(plan: ActionPlan, profile: FamilyProfile, opts: RenderOptions): string {
  const name = profile.person.preferredName || profile.person.firstName;
  const full = `${profile.person.firstName} ${profile.person.lastName}`;
  const issued = fmtDate(plan.updatedAt);
  const live = plan.actions.filter(open);
  const retired = plan.actions.filter((a) => !open(a));
  const actionByKey = new Map(plan.actions.map((a) => [a.key, a]));
  const srcIndex = new Map(plan.sources.map((s, i) => [s.id, i + 1]));
  const ref = (id?: string) => (id && srcIndex.has(id) ? ` <span class="muted small">[${srcIndex.get(id)}]</span>` : "");

  const cover = `
  <div class="cover">
    <div class="brand">${LOGO}<span>${BRAND.name}</span></div>
    <h1>Family Action Plan for ${esc(full)}</h1>
    <p class="for">Prepared for ${esc(profile.preparedFor.name)}${profile.preparedFor.relationship === "self" ? "" : `, ${esc(profile.preparedFor.relationship)}`}</p>
    <dl>
      <dt>Date</dt><dd>${esc(issued)}</dd>
      <dt>Plan version</dt><dd>Version ${esc(plan.version)}</dd>
      <dt>Plan reference</dt><dd>${esc(plan.planId)}</dd>
    </dl>
    <p class="conf">This plan contains personal information. Please share it only with people involved in ${esc(name)}'s care.</p>
  </div>`;

  // Q18A: flagged separately, before the ordinary planning content, and never mixed into the action table.
  const urgent = !plan.summary.urgent ? "" : `
  <section class="urgent">
    <h2>Things you told us may need urgent attention</h2>
    <ul>${plan.summary.urgent.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    <p class="guidance">${esc(plan.summary.urgent.guidance)}</p>
    <p class="meta">These are listed separately from the planning steps in the rest of this plan.</p>
  </section>`;

  const glance = `
  <section>
    <h2>Your plan at a glance</h2>
    <div class="glance">
      <div class="box"><div class="label">Key priorities</div><ul class="plist">${plan.priorities.map((p) => `<li>${chip(p.level)}<span>${esc(p.title)}</span></li>`).join("")}</ul></div>
      <div class="box"><div class="label">What needs attention</div>${plan.summary.attention.length ? `<ul>${plan.summary.attention.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : `<p>Nothing urgent right now. The actions below help ${esc(name)} plan ahead.</p>`}
        <p class="meta">${live.length} actions in this plan, ${live.filter((a) => a.priority === "now").length} to start now.</p></div>
      <div class="box next"><div class="label">Recommended next step</div><div class="big">${esc(plan.summary.nextStep)}</div></div>
    </div>
  </section>`;

  const priorities = `
  <section>
    <h2>Your top priorities</h2>
    ${plan.priorities.map((p, i) => `<div class="priority ${p.level}"><div class="num">${i + 1}</div><div><strong>${esc(p.title)}</strong> ${chip(p.level)}<p class="muted" style="margin:1mm 0 0">${esc(p.why)}</p></div></div>`).join("")}
  </section>`;

  const told = `
  <section>
    <h2>What you told us</h2>
    ${plan.summary.situation.map((s) => `<p>${esc(s)}</p>`).join("")}
  </section>`;

  const steps = `
  <section>
    <h2>Recommended next steps</h2>
    <table>
      <thead><tr><th style="width:18mm">Priority</th><th>Action</th><th style="width:38mm">Who</th><th style="width:30mm">When</th></tr></thead>
      <tbody>${byPriority(live).map(([p, xs]) => `<tr class="group"><td colspan="4">${PRIORITY_LABEL[p]}</td></tr>${xs.map((a) => `<tr><td>${chip(a.priority)}</td><td><strong>${esc(a.title)}</strong>${a.status !== "not_started" ? ` <span class="meta">(${STATUS_LABEL[a.status].toLowerCase()})</span>` : ""}<div class="meta">${esc(a.description)}</div></td><td>${esc(a.responsible)}</td><td>${esc(a.timing)}</td></tr>`).join("")}`).join("")}</tbody>
    </table>
  </section>`;

  const modules = `
  <section class="page-break">
    <h2>Your action plan, by topic</h2>
    <p class="muted">Only the topics that apply to ${esc(name)} are included.</p>
    ${plan.modules.map((m) => {
      const acts = m.actionKeys.map((k) => actionByKey.get(k)!).filter(Boolean);
      const qFor = [...new Set(m.questions.map((q) => q.for))];
      const matches = plan.providerMatches.filter((x) => x.moduleId === m.id);
      return `<article class="module">
        <div class="module-head"><h3>${esc(m.title)}</h3>${chip(m.priority)}</div>
        ${when(m.noticed.length, () => `<h4>What we noticed</h4><ul>${m.noticed.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`)}
        ${when(m.whyItMatters, () => `<h4>Why this matters</h4><p>${esc(m.whyItMatters)}</p>`)}
        ${when(acts.length, () => `<h4>What to do next</h4><ul class="todo">${acts.map((a) => `<li><span class="tick${a.status === "completed" ? " done" : ""}"></span><span><strong>${esc(a.title)}</strong> <span class="meta">· ${esc(a.timing)} · ${esc(a.responsible)}</span><br>${esc(a.description)}</span></li>`).join("")}</ul>`)}
        ${when(m.whoCanHelp.length, () => `<h4>Who may be able to help</h4><p>${m.whoCanHelp.map(esc).join(" · ")}</p>`)}
        ${when(m.questions.length, () => `<h4>Questions worth asking</h4>${qFor.map((f) => `<p style="margin-bottom:1mm"><strong>${esc(f)}</strong></p><ul>${m.questions.filter((q) => q.for === f).map((q) => `<li>${esc(q.question)}</li>`).join("")}</ul>`).join("")}`)}
        ${when(m.usefulInformation.length, () => `<h4>Useful information</h4>${m.usefulInformation.map((i) => `<div class="info"><strong>${esc(i.title)}</strong>${ref(i.sourceId)}<br>${esc(i.body)}</div>`).join("")}`)}
        ${when(matches.length, () => `<h4>Options that may suit</h4><p class="meta">Shown because they match ${esc(name)}'s criteria, not as recommendations. Sample providers for testing.</p>${matches.map((x) => `<div class="match"><b>${esc(x.name)}</b><br><span class="yes">Matches: ${x.matched.map(esc).join("; ")}</span>${x.notMatched.length ? `<br><span class="no">Does not match: ${x.notMatched.map(esc).join("; ")}</span>` : ""}${x.unknown.length ? `<br><span class="muted">To check: ${x.unknown.map(esc).join("; ")}</span>` : ""}<br><span class="meta">${x.verifiedOn ? `Information last verified ${esc(fmtDate(x.verifiedOn))}` : "We have not verified this information recently"}</span></div>`).join("")}`)}
      </article>`;
    }).join("")}
  </section>`;

  const checklist = `
  <section class="page-break">
    <h2>Action checklist</h2>
    <p class="muted">Tick actions off as they are done. Your navigator can update the plan with your progress.</p>
    ${byPriority(live).map(([p, xs]) => `<h3>${PRIORITY_LABEL[p]}</h3><ul class="todo">${xs.map((a) => `<li><span class="tick"></span><span>${esc(a.title)} <span class="meta">· ${esc(a.timing)}${a.status !== "not_started" ? ` · ${STATUS_LABEL[a.status]}` : ""}</span></span></li>`).join("")}</ul>`).join("")}
    ${when(retired.length, () => `<h3>Done or no longer needed</h3><ul class="todo">${retired.map((a) => `<li><span class="tick done"></span><span>${esc(a.title)} <span class="meta">· ${STATUS_LABEL[a.status]}</span></span></li>`).join("")}</ul>`)}
  </section>`;

  const support = `
  <section>
    <div class="support">
      <h2>We can help you carry this out</h2>
      <p>${BRAND.name} can help your family work through this plan: making calls, preparing for assessments and appointments, comparing options and updating the plan as things change.</p>
      <p><strong>Phone</strong> ${BRAND.phone} · <strong>Email</strong> ${BRAND.email}</p>
    </div>
  </section>`;

  const sources = `
  <section>
    <h2>Sources and important information</h2>
    ${when(plan.sources.length, () => `<ol class="sources">${plan.sources.map((s) => `<li>${esc(s.title)}, ${esc(s.publisher)}. <a href="${esc(s.url)}">${esc(s.url)}</a> (reviewed ${esc(fmtDate(s.reviewedOn))})</li>`).join("")}</ol>`)}
    <p class="small">Plan ${esc(plan.planId)}, version ${esc(plan.version)}, issued ${esc(issued)}. Generated by ${esc(plan.generatedBy.engine)} ${esc(plan.generatedBy.engineVersion)} with module set ${esc(plan.generatedBy.moduleSet)}.</p>
    <p class="small muted">This plan gives general information based on what your family told us. It is not medical, legal or financial advice. Eligibility for funding and services is decided by the agencies involved, and details such as thresholds change over time. Please check with the relevant professional before making decisions.</p>
  </section>`;

  const body = cover + `<main>${urgent}${glance}${priorities}${told}${steps}${modules}${checklist}${support}${sources}</main>`;
  return doc(`Family Action Plan, ${full}, version ${plan.version}`, body, opts.fonts, `${BRAND.name} · Family Action Plan · ${plan.planId} · v${plan.version}`);
}

/* ------------------------------ Professional Summary ------------------------------ */

const LIVING: Record<string, string> = { alone: "Lives alone", with_partner: "Lives with partner", with_family: "Lives with family", retirement_village: "Retirement village", residential_care: "Residential care", other: "Other" };
const MOB: Record<string, string> = { independent: "Independent", uses_aid: "Walks with an aid", needs_help: "Needs help to mobilise", wheelchair: "Wheelchair user" };
const EPOA: Record<string, string> = { yes: "In place", no: "Not in place", unsure: "Not confirmed" };
const NASC: Record<string, string> = { none: "Not yet assessed", requested: "Assessment requested", completed: "Assessment completed" };
const LEVEL: Record<string, string> = { home_support: "home support", rest_home: "rest home level", hospital: "hospital level", dementia: "dementia level" };
const SUPPORT: Record<string, string> = { family: "Family", home_help: "Home help", personal_care: "Personal care", meals: "Meals", nursing: "District nursing", day_programme: "Day programme", other: "Other" };

export function renderSummaryHtml(plan: ActionPlan, profile: FamilyProfile, opts: RenderOptions): string {
  const p = profile;
  const full = `${p.person.firstName} ${p.person.lastName}`;
  // Short lists print inline to keep the summary to one page where possible; long ones become bullet lists.
  const li = (xs: string[]) => (!xs.length ? `<span class="muted">None recorded</span>` : xs.join("; ").length <= 110 ? esc(xs.join("; ")) : `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
  const underway = plan.actions.filter((a) => ["in_progress", "waiting_third_party", "completed"].includes(a.status));
  const events = [
    p.hospital.status === "in_hospital" ? `In hospital${p.hospital.reason ? `: ${p.hospital.reason}` : ""}${p.hospital.dischargeDate ? ` (discharge expected ${fmtDate(p.hospital.dischargeDate)})` : ""}` : "",
    p.hospital.status === "discharged_recently" ? `Recently discharged${p.hospital.reason ? ` after ${p.hospital.reason.toLowerCase()}` : ""}` : "",
    p.mobility.fallsLast12Months ? `${p.mobility.fallsLast12Months} fall${p.mobility.fallsLast12Months > 1 ? "s" : ""} in the last 12 months` : "",
  ].filter(Boolean);
  const concerns = [...p.health.concerns, ...(p.cognition.concern !== "none" ? [`Memory and thinking: ${p.cognition.concern} concern${p.cognition.diagnosis === "dementia" ? " (dementia diagnosis)" : p.cognition.diagnosis === "mci" ? " (mild cognitive impairment)" : " (no diagnosis yet)"}`] : []), ...(p.support.mainCarer?.strain === "high" ? [`Main carer (${p.support.mainCarer.relationship}) reports high strain`] : [])];
  const rows: [string, string][] = [
    ...(plan.summary.urgent ? ([["Family flagged as needing attention", li(plan.summary.urgent.items)]] as [string, string][]) : []),
    ...(p.network?.professionals.length ? ([["Already involved", li(p.network.professionals)]] as [string, string][]) : []),
    ["Current living situation", esc(`${LIVING[p.living.situation]}, ${p.person.town}${p.partner ? `. Partner: ${p.partner.name}, ${p.partner.age}` : ""}`)],
    ["Existing support", li(p.support.current.map((s) => `${SUPPORT[s.type]}${s.hoursPerWeek ? `, ${s.hoursPerWeek} h/week` : ""}${s.funded ? " (funded)" : ""}`))],
    ["Mobility", esc(`${MOB[p.mobility.level]}${p.mobility.fearOfFalling ? "; fear of falling" : ""}`)],
    ["Recent significant events", li(events)],
    ["Health conditions", li(p.health.conditions)],
    ["Main concerns", li(concerns)],
    ["Family goals", li(p.goals)],
    ["Current services", li(p.support.current.filter((s) => s.type !== "family").map((s) => SUPPORT[s.type] + (s.provider ? `: ${s.provider}` : "")))],
    ["Existing assessments", esc(`${NASC[p.funding.needsAssessment]}${p.funding.assessedLevel ? `, ${LEVEL[p.funding.assessedLevel]}` : ""}`)],
    ["EPOA status", esc(`Property: ${EPOA[p.legal.epoaProperty]}. Personal care and welfare: ${EPOA[p.legal.epoaWelfare]}${p.legal.epoaActivated ? " (activated)" : ""}.`)],
    ["Main priorities", li(plan.priorities.map((x) => `${PRIORITY_LABEL[x.level]}: ${x.title}`))],
    ["Actions already underway", li(underway.map((a) => `${a.title} (${STATUS_LABEL[a.status].toLowerCase()})`))],
  ];
  const body = `
  <header class="sum-head">
    <div><div class="label">Professional summary</div><h1>${esc(full)}, ${p.person.age}</h1><p class="muted" style="margin:1mm 0 0">${esc(p.person.town)} · Family contact: ${esc(p.preparedFor.name)}${p.preparedFor.relationship === "self" ? "" : ` (${esc(p.preparedFor.relationship)})`}</p></div>
    <div class="brand" style="font-size:9pt">${LOGO.replace('width="36" height="36"', 'width="26" height="26"')}<span>${BRAND.name}</span></div>
  </header>
  <table class="facts"><tbody>${rows.map(([k, v]) => `<tr${k.startsWith("Family flagged") ? ' class="flagged"' : ""}><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
  <p class="small muted" style="margin-top:4mm">Summarised from Family Action Plan ${esc(plan.planId)}, version ${esc(plan.version)} (${esc(fmtDate(plan.updatedAt))}). Shared with the family's consent. Information is as reported by the family and has not been clinically verified. Contact ${BRAND.name}: ${BRAND.phone}.</p>`;
  return doc(`Professional summary, ${full}`, body, opts.fonts, `${BRAND.name} · Professional summary · ${plan.planId} · v${plan.version}`, true);
}
