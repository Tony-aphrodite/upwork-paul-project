/**
 * Validation rules shared by the browser and the server, so a form never accepts what the API then refuses.
 * No server-only imports.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
/** Digits, spaces, +, brackets and hyphens, with at least six digits. */
export const PHONE_CHARS = /^[0-9 +()-]*$/;
export const isPhone = (s: string) => PHONE_CHARS.test(s.trim()) && s.replace(/\D/g, "").length >= 6;

export const LIMITS = { name: 120, email: 200, phone: 40, firstName: 80, shortAnswer: 200, longAnswer: 2000, message: 2000, bestTime: 200 } as const;
export const MIN_PASSWORD = 12;

/** ?ref= values: lower-case letters, numbers, hyphens and underscores only, at most 40 characters. */
export const cleanReferral = (s?: string | null) => {
  const r = (s ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return r || undefined;
};
