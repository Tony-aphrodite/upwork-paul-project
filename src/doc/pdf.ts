import type { Browser } from "puppeteer-core";

/**
 * HTML → PDF with headless Chromium. Local runs use CHROME_PATH (an installed Chrome); on Vercel the serverless
 * Chromium build is used. Nothing touches disk: HTML goes in with setContent and the PDF comes back as bytes.
 */
let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: [...chromium.args, "--font-render-hinting=none"] });
}

async function browser() {
  if (!browserPromise) browserPromise = launch().catch((e) => { browserPromise = null; throw e; });
  const b = await browserPromise;
  if (!b.connected) { browserPromise = null; return browser(); }
  return b;
}

export async function htmlToPdf(html: string): Promise<Uint8Array> {
  const page = await (await browser()).newPage();
  try {
    await page.setJavaScriptEnabled(false); // templates need no scripts; this also blocks anything injected through data
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    await page.evaluateHandle("document.fonts.ready").catch(() => undefined);
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Count pages without a PDF library: every page object has "/Type /Page" (not "/Pages"). */
export const pageCount = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

export async function closeBrowser() {
  if (browserPromise) (await browserPromise).close().catch(() => undefined);
  browserPromise = null;
}
