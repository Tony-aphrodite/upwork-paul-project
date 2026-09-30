import { db } from "./db";
import { hashPassword, hashToken, newToken, verifyPassword } from "./secrets";

/**
 * Navigator accounts. There is no sign-up: an account is created by `scripts/add-navigator.ts`, which prints a
 * one-time setup link (valid 48 hours). The navigator opens it and chooses their own password, so no password is
 * ever sent by chat or email. Running the script again for the same email issues a new link (a password reset).
 */

export type Navigator = { id: string; email: string; name: string };
export const MIN_PASSWORD = 12;
const SETUP_HOURS = 48;

export async function issueSetupLink(email: string, name: string): Promise<{ navigator: Navigator; token: string }> {
  const d = await db();
  const token = newToken();
  const expires = new Date(Date.now() + SETUP_HOURS * 3_600_000).toISOString();
  const [r] = await d.query<{ id: string; email: string; name: string }>(
    `insert into navigators (email, name, setup_token_hash, setup_expires_at) values (lower($1), $2, $3, $4)
     on conflict (email) do update set name = excluded.name, setup_token_hash = excluded.setup_token_hash, setup_expires_at = excluded.setup_expires_at, disabled_at = null
     returning id, email, name`, [email.trim(), name.trim(), hashToken(token), expires]);
  return { navigator: { id: r.id, email: r.email, name: r.name }, token };
}

export async function setupTokenValid(token: string): Promise<{ name: string; email: string } | null> {
  const [r] = await (await db()).query<{ name: string; email: string }>(
    "select name, email from navigators where setup_token_hash = $1 and setup_expires_at > now() and disabled_at is null", [hashToken(token)]);
  return r ?? null;
}

export async function completeSetup(token: string, password: string): Promise<Navigator | null> {
  if (password.length < MIN_PASSWORD) return null;
  const hash = await hashPassword(password);
  const [r] = await (await db()).query<{ id: string; email: string; name: string }>(
    `update navigators set password_hash = $2, setup_token_hash = null, setup_expires_at = null
     where setup_token_hash = $1 and setup_expires_at > now() and disabled_at is null returning id, email, name`, [hashToken(token), hash]);
  return r ? { id: r.id, email: r.email, name: r.name } : null;
}

export async function checkLogin(email: string, password: string): Promise<Navigator | null> {
  const [r] = await (await db()).query<{ id: string; email: string; name: string; password_hash: string | null }>(
    "select id, email, name, password_hash from navigators where email = lower($1) and disabled_at is null", [email.trim()]);
  const ok = await verifyPassword(password, r?.password_hash);
  return ok && r ? { id: r.id, email: r.email, name: r.name } : null;
}

export async function activeNavigator(id: string): Promise<Navigator | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await (await db()).query<Navigator>("select id, email, name from navigators where id = $1 and disabled_at is null and password_hash is not null", [id]);
  return r ?? null;
}

export async function navigatorEmails(): Promise<string[]> {
  const rows = await (await db()).query<{ email: string }>("select email from navigators where disabled_at is null and password_hash is not null order by created_at");
  return rows.map((r) => r.email);
}

export async function disableNavigator(email: string): Promise<boolean> {
  const rows = await (await db()).query("update navigators set disabled_at = now(), setup_token_hash = null where email = lower($1) returning id", [email.trim()]);
  return rows.length > 0;
}
