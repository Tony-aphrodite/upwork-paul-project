export const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/** ?ref= values: lower-case letters, numbers, hyphens and underscores only, at most 40 characters. */
export const cleanReferral = (s?: string | null) => {
  const r = (s ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return r || undefined;
};
