import { SignJWT, jwtVerify } from "jose";

/**
 * Navigator sessions: a signed, short-lived JWT in an httpOnly cookie. It carries the navigator's id and when it was
 * issued; every admin page and API also checks that the account is active and that the session was issued after the
 * account's last reset or disabling, so both take effect at once. Works in the Edge runtime (middleware) and in Node.
 *
 * SameSite=Lax (not Strict) so the "Open the case" link in a navigator's email arrives signed in; requests that
 * change something are also checked for a same-site Origin (`session.ts`).
 */
export const SESSION_COOKIE = "an_session";
export const SESSION_HOURS = 8;

/** AUTH_SECRET: required, 32+ characters, wherever real data is (Vercel, or any DATABASE_URL). */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET ?? "";
  const real = !!process.env.VERCEL || !!process.env.DATABASE_URL;
  if (s.length >= 32) return s;
  if (real) throw new Error("AUTH_SECRET must be set to at least 32 random characters");
  return "dev-only-secret-change-me-dev-only-secret";
}
const key = () => new TextEncoder().encode(authSecret());

export async function createSession(navigator: { id: string; name: string }) {
  return new SignJWT({ name: navigator.name }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`).setSubject(navigator.id).sign(key());
}

export type Session = { id: string; name: string; issuedAt: number };

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub && typeof payload.iat === "number" ? { id: payload.sub, name: String(payload.name ?? ""), issuedAt: payload.iat } : null;
  } catch { return null; }
}

export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_HOURS * 3600 };
