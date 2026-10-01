/*
 * Create a navigator, or issue a new setup link (a password reset), or disable one.
 *   npm run navigator -- --email dee@example.test --name "Dee"
 *   npm run navigator -- --email dee@example.test --disable
 * Needs DATABASE_URL for production and APP_URL for the link. Locally, stop the dev server first (PGlite allows one process).
 * The link is printed once: send it to the navigator privately. It works once, for 48 hours.
 */
import { args } from "./lib/args";
import { config } from "../src/lib/config";
import { disableNavigator, issueSetupLink } from "../src/lib/navigators";

const { flags } = args();
const email = typeof flags.email === "string" ? flags.email : "";
if (!/^[^@\s]+@[^@\s]+$/.test(email)) { console.error("Give --email"); process.exit(1); }
if (flags.disable) {
  console.log((await disableNavigator(email)) ? `Disabled ${email}.` : `No navigator ${email}.`);
  process.exit(0);
}
const name = typeof flags.name === "string" ? flags.name : "";
if (!name) { console.error('Give --name "Their name"'); process.exit(1); }
const { navigator, token } = await issueSetupLink(email, name);
console.log(`Setup link for ${navigator.name} <${navigator.email}> (valid 48 hours, works once):\n${config.appUrl()}/setup/${token}`);
process.exit(0);
