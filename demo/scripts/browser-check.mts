/*
 * The whole pilot in real Chrome, at desktop width and at 390 px: questionnaire (with resume), submission, sign-in,
 * review, edit, preview, release, the family's page, PDF, help request, feedback and CSV. Every page is checked for
 * sideways scrolling and console errors, and screenshots are saved.
 *
 *   BASE=http://localhost:3000 NAV_EMAIL=you@example.test NAV_PASSWORD='…' npm run check:browser
 *   (or SETUP_TOKEN=… instead of NAV_PASSWORD, to set the password through a fresh setup link)
 *
 * Needs Google Chrome (CHROME_PATH, default /usr/bin/google-chrome) and a running app with a navigator account.
 * Uses the fictional families; never point it at production with real families in it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright-core";
import { FAMILIES, type Family } from "../tests/pilot-families";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.OUT ?? ".browser-check";
const NAV_EMAIL = process.env.NAV_EMAIL ?? "";
const NAV_PASSWORD = process.env.NAV_PASSWORD ?? "a long enough password";
const SETUP_TOKEN = process.env.SETUP_TOKEN ?? "";
if (/ageingnavigator\.com/.test(BASE)) { console.error("This looks like production. The check submits fictional families: use staging."); process.exit(1); }
if (!NAV_EMAIL && !SETUP_TOKEN) { console.error("Set NAV_EMAIL and NAV_PASSWORD, or SETUP_TOKEN."); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const problems: string[] = [];
const note = (m: string) => console.log(m);
const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } } as const;
type Viewport = keyof typeof VIEWPORTS;

async function check(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (sw > cw + 1) problems.push(`${name}: scrolls sideways (${sw} > ${cw})`);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

function watch(page: Page, label: string) {
  page.on("console", (m) => { if (m.type() === "error" && !/status of 401/.test(m.text())) problems.push(`${label} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${label} page error: ${e.message}`));
}

/** Questions can appear inside a section once an earlier one is answered: repeat until no new ones show up. */
async function fillSection(page: Page, answers: Family["answers"]) {
  const filled = new Set<string>();
  for (;;) {
    const ids = (await page.$$eval('fieldset[id^="q-"]', (fs) => fs.map((f) => f.id.slice(2)))).filter((id) => !filled.has(id));
    if (!ids.length) return;
    for (const id of ids) {
      filled.add(id);
      const v = answers[id];
      if (v === undefined) continue;
      const field = page.locator(`#q-${id}`);
      if (typeof v === "string") {
        const radio = field.locator(`input[type=radio][value="${v}"]`);
        if (await radio.count()) await radio.check();
        else await field.locator("input, textarea").first().fill(v);
      } else if (Array.isArray(v)) {
        for (const x of v) await field.locator(`input[type=checkbox][value="${x}"]`).check();
      } else {
        for (const [item, x] of Object.entries(v)) await page.locator(`input[name="${id}-${item}"][value="${x}"]`).check();
      }
    }
  }
}

async function familyRun(browser: Browser, vp: Viewport, fam: Family) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp] });
  const page = await ctx.newPage();
  watch(page, `family-${vp}`);
  await page.goto(`${BASE}/?ref=check`);
  await check(page, `${vp}-01-home`);
  await page.getByRole("link", { name: "Start the questionnaire" }).click();
  await page.waitForURL(/\/start\?ref=check/);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start" }).click();
  if (!(await page.getByText("Please tick the box to continue.").isVisible())) problems.push(`${vp}: consent not enforced`);
  await check(page, `${vp}-02-intro`);
  await page.locator("input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Start" }).click();
  let sections = 0;
  for (;;) {
    await page.waitForSelector("form h1");
    if ((await page.locator("form h1").innerText()).startsWith("Where should we send")) break;
    if (sections === 0) {
      await page.getByRole("button", { name: "Continue" }).click(); // skipping without answers must be stopped
      if (!(await page.locator("[role=alert]").first().isVisible())) problems.push(`${vp}: required answers not enforced`);
    }
    await fillSection(page, fam.answers);
    if (sections < 2) await check(page, `${vp}-03-section-${sections + 1}`);
    await page.getByRole("button", { name: "Continue" }).click();
    sections++;
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    if (focused !== "H1") problems.push(`${vp}: focus not on the new heading after Continue (${focused})`);
    if (sections === 3 && vp === "desktop") {
      const here = await page.locator("form h1").innerText();
      await page.reload();
      await page.locator("input[type=checkbox]").first().check();
      await page.getByRole("button", { name: "Continue where you left off" }).click();
      await page.waitForSelector("form h1");
      const back = await page.locator("form h1").innerText();
      if (back !== here) problems.push(`resume went to "${back}", expected "${here}"`);
    }
    if (sections > 30) { problems.push(`${vp}: questionnaire did not end`); break; }
  }
  await page.fill("#c-name", fam.person.contactName);
  await page.fill("#c-email", fam.contact.email);
  await page.fill("#c-phone", fam.contact.phone);
  if (await page.locator("#c-firstName").count()) {
    await page.fill("#c-firstName", fam.person.firstName);
    if (fam.person.preferredName) await page.fill("#c-preferredName", fam.person.preferredName);
  }
  await check(page, `${vp}-04-contact`);
  await page.getByRole("button", { name: "Send my answers" }).click();
  await page.getByRole("heading", { name: "Your answers have been sent" }).waitFor({ timeout: 20000 });
  const ref = (await page.locator("strong.font-mono").innerText()).trim();
  const urgentShown = await page.getByText("Something may need urgent attention").isVisible();
  note(`${vp}: ${sections} sections, submitted ${ref}${urgentShown ? " (urgent)" : ""}`);
  await check(page, `${vp}-05-thanks`);
  await ctx.close();
  return { ref, urgentShown };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true });
try {
  const a = await familyRun(browser, "desktop", FAMILIES[0]);
  const b = await familyRun(browser, "mobile", FAMILIES[2]);
  if (a.urgentShown) problems.push("a family with nothing urgent saw the urgent box");
  if (!b.urgentShown) problems.push("the urgent family did not see the urgent box");

  const nctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const nav = await nctx.newPage();
  watch(nav, "navigator");
  await nav.goto(`${BASE}/admin`);
  if (!nav.url().includes("/login")) problems.push("the case list opened without signing in");
  await check(nav, "desktop-10-login");
  if (SETUP_TOKEN) {
    await nav.goto(`${BASE}/setup/${SETUP_TOKEN}`);
    await nav.fill("#password", NAV_PASSWORD);
    await nav.fill("#again", NAV_PASSWORD);
    await nav.getByRole("button", { name: "Set password and sign in" }).click();
  } else {
    await nav.fill("#email", NAV_EMAIL);
    await nav.fill("#password", "not the password");
    await nav.getByRole("button", { name: "Sign in" }).click();
    await nav.getByText("do not match").waitFor();
    await nav.fill("#password", NAV_PASSWORD);
    await nav.getByRole("button", { name: "Sign in" }).click();
  }
  await nav.waitForURL(/\/admin$/);
  if ((await nav.locator("li .font-mono").first().innerText()) !== b.ref) problems.push("the urgent case is not first in the list");
  await check(nav, "desktop-11-cases");
  const csp = (await nav.request.get(`${BASE}/admin`)).headers()["content-security-policy"];
  if (!csp?.includes("frame-ancestors 'none'")) problems.push("no Content Security Policy header");

  await nav.getByText(a.ref).click();
  await nav.waitForURL(/\/admin\/cases\//);
  await nav.getByRole("heading", { name: "D. Priority actions", exact: false }).waitFor();
  await check(nav, "desktop-12-case");
  const edited = "Ask the GP for a needs assessment referral this week";
  await nav.getByLabel("What to do").first().fill(edited);
  await nav.locator("div.rounded-lg.border", { has: nav.getByLabel("What to do") }).nth(1).getByRole("button", { name: /^Remove/ }).click();
  await nav.getByRole("button", { name: "Save changes" }).click();
  await nav.getByText("Saved.").waitFor();
  await nav.getByRole("button", { name: "Preview" }).click();
  if (!(await nav.locator(".anplan").innerText()).includes(edited)) problems.push("the preview does not show the edit");
  await check(nav, "desktop-13-preview");
  const caseUrl = nav.url();
  const preview = await nav.request.get(caseUrl.replace("/admin/cases/", "/api/admin/cases/") + "/pdf");
  if (preview.status() !== 200 || (await preview.body()).subarray(0, 4).toString() !== "%PDF") problems.push(`preview PDF failed (${preview.status()})`);

  await nav.getByRole("button", { name: "Approve and release" }).click();
  await nav.getByRole("button", { name: "Yes, release" }).click();
  await nav.getByText("This link is shown once").waitFor({ timeout: 20000 });
  const link = (await nav.locator("code").first().innerText()).trim();
  await check(nav, "desktop-14-released");

  const mctx = await browser.newContext({ viewport: VIEWPORTS.mobile, storageState: await nctx.storageState() });
  const mnav = await mctx.newPage();
  watch(mnav, "navigator-mobile");
  await mnav.goto(`${BASE}/admin`);
  await check(mnav, "mobile-11-cases");
  await mnav.goto(caseUrl);
  await check(mnav, "mobile-12-case");

  for (const vp of ["desktop", "mobile"] as const) {
    const fctx = await browser.newContext({ viewport: VIEWPORTS[vp] });
    const fp = await fctx.newPage();
    watch(fp, `plan-${vp}`);
    await fp.goto(link);
    await fp.getByRole("heading", { name: /^For / }).waitFor();
    if (!(await fp.locator(".anplan").innerText()).includes(edited)) problems.push(`${vp}: the family page lacks the released edit`);
    await check(fp, `${vp}-20-plan`);
    if (vp === "desktop") {
      const pdf = await fp.request.get(link.replace("/p/", "/api/p/") + "/pdf");
      const body = await pdf.body();
      if (pdf.status() !== 200 || body.subarray(0, 4).toString() !== "%PDF") problems.push(`family PDF failed (${pdf.status()})`);
      writeFileSync(`${OUT}/family.pdf`, body);
      try {
        if (execFileSync("pdftotext", [`${OUT}/family.pdf`, "-"]).toString().includes("/p/")) problems.push("the family PDF contains the private link");
      } catch { note("pdftotext not installed: PDF text not checked"); }
      await fp.fill("#rq-phone", "0123456789");
      await fp.getByRole("button", { name: "Ask Ageing Navigator for help" }).click();
      await fp.getByRole("status").first().waitFor();
      await fp.getByLabel("Very useful").check();
      await fp.getByLabel("Partly").check();
      await fp.getByRole("button", { name: "Send feedback" }).click();
      await fp.getByText("Thank you for your feedback.").waitFor();
      await check(fp, `${vp}-21-plan-after-request`);
    }
    await fctx.close();
  }
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`${BASE}/p/${"x".repeat(43)}`);
  if (!(await stranger.getByText("This link is not valid any more").isVisible())) problems.push("the invalid-link page is missing");

  await nav.reload();
  await nav.getByRole("tab", { name: /Requests and feedback/ }).click();
  if (!(await nav.getByText("Home Support Setup").first().isVisible())) problems.push("the request is not shown to the navigator");
  await check(nav, "desktop-15-requests");
  const csv = await nav.request.get(`${BASE}/api/admin/export`);
  const csvText = await csv.text();
  if (csv.status() !== 200 || !csvText.includes(a.ref)) problems.push("CSV export failed");
  if (/example\.test|0123456789/.test(csvText)) problems.push("the CSV contains contact details");
} finally {
  await browser.close();
}
console.log(problems.length ? `PROBLEMS (${problems.length}):\n- ${problems.join("\n- ")}` : `NO PROBLEMS. Screenshots in ${OUT}/`);
process.exit(problems.length ? 1 : 0);
