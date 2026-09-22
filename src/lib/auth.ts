import { SignJWT, jwtVerify } from "jose";

/**
 * Admin sessions: a signed, short-lived JWT in an httpOnly, SameSite=Strict cookie. No session data is stored server-side.
 * Production would put this behind the organisation's identity provider; the middleware check stays the same.
 */
export const SESSION_COOKIE = "kf_session";
export const SESSION_HOURS = 8;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.VERCEL) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
};

/** The demo password is published on the login page so reviewers can get in; set ADMIN_PASSWORD to change it. */
export const adminPassword = () => process.env.ADMIN_PASSWORD ?? "navigator-demo";
export const isDemoPassword = () => !process.env.ADMIN_PASSWORD;

export async function createSession(role: "admin" = "admin") {
  return new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`).setSubject("admin").sign(secret());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  try { return (await jwtVerify(token, secret(), { algorithms: ["HS256"] })).payload; } catch { return null; }
}

/** Constant-time comparison so response timing does not leak how much of the password was right. */
export function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
