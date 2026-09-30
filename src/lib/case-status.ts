/**
 * Case statuses and feedback answers: shared by the database layer, the API and the browser, so this file imports
 * nothing server-side. The database CHECK constraints in migrations.ts list the same values.
 */
export const CASE_STATUSES = ["submitted", "in_review", "released", "closed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const STATUS_LABEL: Record<CaseStatus, string> = { submitted: "New", in_review: "In review", released: "Released", closed: "Closed" };

export const REQUEST_STATUSES = ["new", "contacted", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { new: "New", contacted: "Contacted", closed: "Closed" };

/** The pilot's feedback questions for the free plan (build brief section 41). */
export const USEFUL = [["very", "Very useful"], ["somewhat", "Somewhat useful"], ["not_really", "Not really useful"]] as const;
export const MADE_SENSE = [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]] as const;
export type Feedback = {
  useful: (typeof USEFUL)[number][0];
  madeSense: (typeof MADE_SENSE)[number][0];
  missing: string;
  confusing: string;
  wantsHelp: boolean;
};
export const FEEDBACK_LABEL: Record<string, string> = Object.fromEntries([...USEFUL, ...MADE_SENSE]);
