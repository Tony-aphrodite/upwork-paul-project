import { config } from "./config";
import { releaseEmail, sendEmail } from "./email";
import { setReleaseEmailStatus } from "./cases";
import { content } from "./pilot/library";

/** The family's private address for a token. Only the hash of the token is stored; this is the one time it exists. */
export const familyLink = (token: string) => `${config.appUrl()}/p/${token}`;

/** Email the family their link and record whether it went, so a failure shows on the case. */
export async function emailFamilyLink(c: { id: string; contactEmail: string }, token: string, expires: Date): Promise<boolean> {
  const sent = await sendEmail(releaseEmail(content.texts, c.contactEmail, familyLink(token), expires));
  await setReleaseEmailStatus(c.id, sent ? "sent" : "failed");
  return sent;
}
