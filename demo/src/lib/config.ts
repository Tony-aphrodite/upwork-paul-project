/**
 * Settings that change between environments or that the client decides. Everything has a safe default for local
 * development; production sets the environment variables listed in the handover note.
 */
export const config = {
  /** Public address of the app, used in emails, e.g. https://plan.ageingnavigator.co.nz */
  appUrl: () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** How long a case is kept after its plan is released, then deleted with its link (proposed: 12 months). */
  retentionMonthsAfterRelease: () => Number(process.env.RETENTION_MONTHS_AFTER_RELEASE ?? 12),
  /** How long a case that was never released is kept. */
  retentionDaysUnreleased: () => Number(process.env.RETENTION_DAYS_UNRELEASED ?? 60),
  /** Sender for all email, on the client's verified domain. */
  emailFrom: () => process.env.EMAIL_FROM ?? "Ageing Navigator <plans@example.test>",
  /** Where family replies go, if different from the sender. */
  emailReplyTo: () => process.env.EMAIL_REPLY_TO,
  /** Set to 1 on the real production: families cannot submit, and plans cannot be released, while content is a draft. */
  requireApprovedContent: () => process.env.REQUIRE_APPROVED_CONTENT === "1",
};

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
