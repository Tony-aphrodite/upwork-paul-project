import { db } from "./db";
import { hashPassword, hashToken, newToken, verifyPassword } from "./secrets";
import { MIN_PASSWORD } from "./validate";

export { MIN_PASSWORD };

/**
 * Navigator accounts. There is no sign-up: an account is created by `scripts/add-navigator.mts`, which prints a
 * one-time setup link (valid 48 hours). The navigator opens it and chooses their own password, so no password is
 * ever sent by chat or email.
 *
 * Issuing a link again for the same email is a reset: the old password stops working and every existing session
 * ends at once, until the new link is used. Disabling ends every session at once too.
 */

export type Navigator = { id: string; email: string; name: string };
const SETUP_HOURS = 48;

export async function issueSetupLink(email: string, name: string): Promise<{ navigator: Navigator; token: string }> {
  const token = newToken();
  const expires = new Date(Date.now() + SETUP_HOURS * 3_600_000).toISOString();
  const [r] = await (await db()).query<Navigator>(
    `insert into navigators (email, name, setup_token_hash, setup_expires_at) values (lower($1), $2, $3, $4)
     on conflict (email) do update set name = excluded.name, setup_token_hash = excluded.setup_token_hash, setup_expires_at = excluded.setup_expires_at,
       disabled_at = null, password_hash = null, sessions_valid_after = now()
     returning id, email, name`, [email.trim(), name.trim(), hashToken(token), expires]);
  return { navigator: r, token };
}

export async function setupTokenValid(token: string): Promise<{ name: string; email: string } | null> {
  const [r] = await (await db()).query<{ name: string; email: string }>(
    "select name, email from navigators where setup_token_hash = $1 and setup_expires_at > now() and disabled_at is null", [hashToken(token)]);
  return r ?? null;
}

export async function completeSetup(token: string, password: string): Promise<Navigator | null> {
  if (password.length < MIN_PASSWORD) return null;
  const hash = await hashPassword(password);
  const [r] = await (await db()).query<Navigator>(
    `update navigators set password_hash = $2, setup_token_hash = null, setup_expires_at = null
     where setup_token_hash = $1 and setup_expires_at > now() and disabled_at is null returning id, email, name`, [hashToken(token), hash]);
  return r ?? null;
}

export async function checkLogin(email: string, password: string): Promise<Navigator | null> {
  const [r] = await (await db()).query<Navigator & { password_hash: string | null }>(
    "select id, email, name, password_hash from navigators where email = lower($1) and disabled_at is null", [email.trim()]);
  const ok = await verifyPassword(password, r?.password_hash);
  return ok && r ? { id: r.id, email: r.email, name: r.name } : null;
}

/**
 * The navigator behind a session, if the account is active, has a password, and the session was issued (JWT `iat`,
 * whole seconds) no earlier than the account's last reset or disabling.
 */
export async function activeNavigator(id: string, issuedAt: number): Promise<Navigator | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await (await db()).query<Navigator>(
    `select id, email, name from navigators where id = $1 and disabled_at is null and password_hash is not null
       and floor(extract(epoch from sessions_valid_after)) <= $2`, [id, issuedAt]);
  return r ?? null;
}

export async function navigatorEmails(): Promise<string[]> {
  const rows = await (await db()).query<{ email: string }>("select email from navigators where disabled_at is null and password_hash is not null order by created_at");
  return rows.map((r) => r.email);
}

export async function disableNavigator(email: string): Promise<boolean> {
  const rows = await (await db()).query("update navigators set disabled_at = now(), setup_token_hash = null, sessions_valid_after = now() where email = lower($1) returning id", [email.trim()]);
  return rows.length > 0;
}
