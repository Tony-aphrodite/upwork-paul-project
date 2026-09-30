import { SignJWT, jwtVerify } from "jose";

/**
 * Navigator sessions: a signed, short-lived JWT in an httpOnly, SameSite=Strict cookie. It carries the navigator's
 * id; every admin page and API also checks the account is still active, so disabling a navigator takes effect at once.
 * Works in the Edge runtime (middleware) and in Node (routes).
 */
export const SESSION_COOKIE = "an_session";
export const SESSION_HOURS = 8;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
};

export async function createSession(navigator: { id: string; name: string }) {
  return new SignJWT({ name: navigator.name }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`).setSubject(navigator.id).sign(secret());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ? { id: payload.sub, name: String(payload.name ?? "") } : null;
  } catch { return null; }
}

export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: SESSION_HOURS * 3600 };
