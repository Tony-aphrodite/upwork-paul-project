import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/**
 * The privacy policy, from content/pilot/privacy-policy.md: a front matter block (updated: YYYY-MM-DD, status: draft
 * or approved), a "# " title, then Markdown. The same file makes the page at /privacy and the PDF the client reviews
 * (npm run doc:pdf). The wording is the client's to approve; while it is a draft the page says so.
 */
export type PrivacyPolicy = { updated: string; status: "draft" | "approved"; title: string; html: string };

export function parsePolicy(md: string): PrivacyPolicy {
  const fm = /^---\n([\s\S]*?)\n---\n+/.exec(md);
  if (!fm) throw new Error("The privacy policy needs its front matter (updated, status).");
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(fm[1])?.[1].trim() ?? "";
  const updated = field("updated"), status = field("status");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) throw new Error(`The privacy policy's "updated" must be YYYY-MM-DD, not "${updated}".`);
  if (status !== "draft" && status !== "approved") throw new Error(`The privacy policy's "status" must be draft or approved, not "${status}".`);
  const rest = md.slice(fm[0].length);
  const title = /^# (.+)$/m.exec(rest)?.[1].trim();
  if (!title) throw new Error("The privacy policy needs a \"# \" title.");
  const html = marked.parse(rest.replace(/^# .+\n+/m, ""), { gfm: true, async: false }) as string;
  return { updated, status, title, html };
}

/** Read at build time: the page is static. */
export const loadPolicy = () => parsePolicy(readFileSync(join(process.cwd(), "content/pilot/privacy-policy.md"), "utf8"));
