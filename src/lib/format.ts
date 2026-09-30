const NZ = "Pacific/Auckland";
export const nzDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: NZ }) : "");
export const nzDateTime = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: NZ }) : "");
export const PATHWAY_LABEL: Record<string, string> = { stay_home: "Stay at home", village: "Retirement village", residential: "Residential care" };
