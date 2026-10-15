import { describe, expect, it } from "vitest";
import contentJson from "../content/pilot/content.json";
import { PilotContent } from "../src/lib/pilot/content";
import { loadPolicy, parsePolicy } from "../src/lib/pilot/privacy";
import { BRAND } from "../src/lib/brand";
import { config } from "../src/lib/config";

const content = PilotContent.parse(contentJson);
const policy = loadPolicy();
const text = policy.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the privacy policy", () => {
  it("is read from its file, with a date and a status, and refuses a broken file", () => {
    expect(policy.title).toBe("Privacy Policy");
    expect(policy.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(["draft", "approved"]).toContain(policy.status);
    expect(() => parsePolicy("# Privacy Policy\n\nText")).toThrow(/front matter/);
    expect(() => parsePolicy("---\nupdated: 15 Oct\nstatus: draft\n---\n# P\n")).toThrow(/YYYY-MM-DD/);
    expect(() => parsePolicy("---\nupdated: 2026-10-15\nstatus: final\n---\n# P\n")).toThrow(/draft or approved/);
  });

  it("states what the service really does: where, how long, who, no AI, and how to ask", () => {
    for (const h of ["What we collect", "How we use it", "Who can see it", "Where it is stored", "How long we keep it", "Your rights", "Questions and complaints"])
      expect(policy.html).toContain(`<h2>${h}</h2>`);
    expect(text).toContain(`${config.retentionMonthsAfterRelease()} months after your plan is sent`);
    expect(text).toMatch(/Sydney, Australia/);
    expect(text).toMatch(/no AI service receives your answers/);
    expect(policy.html).toContain(`mailto:${BRAND.email}`);
    expect(text).toMatch(/Privacy Commissioner/);
    expect(text).not.toMatch(/\[|TODO|TBC|lorem/i); // no placeholder left for families to see
  });

  it("agrees with the consent wording, which links to it", () => {
    expect(content.texts.privacy_policy_url).toBe("/privacy");
    expect(content.texts.consent).toMatch(/Australia/);
    expect(content.texts.consent).toMatch(/12 months/);
    expect(text).toMatch(/stored securely in Australia and kept for up to 12 months/);
  });
});
