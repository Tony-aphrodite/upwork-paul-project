import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Tokens, passwords and pseudonymous keys. Server only (node:crypto).
 * - Private links and setup links are 32 random bytes; only a SHA-256 hash is stored, so a copy of the database
 *   cannot open a family's plan.
 * - Passwords use scrypt with a per-password salt.
 * - IP addresses are never stored: rate limits key on an HMAC of the address.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 64;

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // With no stored hash, still spend the time of a real check so timing does not reveal which emails exist.
  const [kind, n, r, p, saltB64, keyB64] = (stored ?? `scrypt$${N}$${R}$${P}$${randomBytes(16).toString("base64")}$${randomBytes(LEN).toString("base64")}`).split("$");
  if (kind !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return !!stored && got.length === expected.length && timingSafeEqual(got, expected);
}

const keySecret = () => process.env.AUTH_SECRET ?? "dev-only-secret-change-me-dev-only-secret";
export const pseudonym = (value: string) => createHmac("sha256", keySecret()).update(value).digest("hex").slice(0, 32);

/** The caller's address as the hosting platform reports it; used only through `pseudonym`. */
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "local").split(",")[0].trim();

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Case references such as AN-7KQ2MX: short enough to read over the phone, no 0/O or 1/I. */
export function newReference(): string {
  const bytes = randomBytes(6);
  return "AN-" + [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}
