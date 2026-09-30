import { caseByTokenHash, type LinkedCase } from "./cases";
import { hashToken } from "./secrets";

/** Tokens are base64url, 43 characters; anything else is refused before touching the database. */
export async function caseForToken(token: string): Promise<LinkedCase | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return caseByTokenHash(hashToken(token));
}
