/*
 * Submit the fictional families through the real questionnaire API, as a family would:
 *   npm run seed:fictional -- [http://localhost:3000]
 * For staging and the acceptance run only. Contact emails are @example.test and the phone is 0123456789.
 */
import { args } from "./lib/args";
import { FAMILIES } from "../tests/pilot-families";

const { rest, flags } = args();
const base = (rest[0] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (/ageingnavigator\.co\.nz/.test(base) && !flags.yes) { console.error("This looks like production. Add --yes if you really mean it."); process.exit(1); }
for (const f of FAMILIES) {
  const res = await fetch(`${base}/api/submit`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${FAMILIES.indexOf(f) + 1}` },
    body: JSON.stringify({ answers: f.answers, contact: { name: f.person.contactName, email: f.contact.email, phone: f.contact.phone }, person: { firstName: f.person.firstName, preferredName: f.person.preferredName }, consent: true, referral: "fictional" }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`${f.id.padEnd(22)} ${res.status} ${body.reference ?? body.error ?? ""}${body.urgent ? " (urgent)" : ""}`);
}
