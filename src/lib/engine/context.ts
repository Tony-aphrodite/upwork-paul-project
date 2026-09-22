import type { FamilyProfile } from "../schema";
import { read } from "./conditions";

const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n: number) => NUM[n] ?? String(n);
export const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const SUPPORT: Record<string, string> = { family: "help from family", home_help: "home help", personal_care: "personal care", meals: "meal delivery", nursing: "district nursing", day_programme: "a day programme", other: "other support" };
const LEVEL: Record<string, string> = { home_support: "home support", rest_home: "rest home", hospital: "hospital", dementia: "dementia" };
const TRI: Record<string, string> = { no: "not in place", unsure: "not confirmed" };
const TIMEFRAME: Record<string, string> = { now: " as soon as possible", within_6_months: " within the next six months", within_2_years: " within the next two years", later: " in the longer term" };

/** Values templates can use, derived once from the profile so module text stays simple. */
export function templateContext(p: FamilyProfile) {
  const name = p.person.preferredName || p.person.firstName;
  const support = p.support.current.map((s) => `${SUPPORT[s.type]}${s.hoursPerWeek ? ` (${s.hoursPerWeek} hours a week)` : ""}`);
  return {
    ...p,
    name,
    fullName: `${p.person.firstName} ${p.person.lastName}`,
    age: p.person.age,
    town: p.person.town,
    preparedFor: p.preparedFor.name,
    carer: p.support.mainCarer?.name ?? "the family carer",
    carerRelationship: p.support.mainCarer?.relationship ?? "family",
    falls: p.mobility.fallsLast12Months === 1 ? "one fall" : `${words(p.mobility.fallsLast12Months)} falls`,
    supportSummary: support.length ? list(support) : "no regular support",
    homeConcerns: list(p.homeSafety.concerns.map(lower)),
    goals: list(p.goals.map(lower)),
    assessedLevel: LEVEL[p.funding.assessedLevel ?? ""] ?? "the assessed",
    epoaPropertyText: TRI[p.legal.epoaProperty] ?? "in place",
    epoaWelfareText: TRI[p.legal.epoaWelfare] ?? "in place",
    hospitalReason: p.hospital.reason ? ` after ${lower(p.hospital.reason)}` : "",
    dischargeText: p.hospital.dischargeDate ? `, with discharge expected on ${fmtDate(p.hospital.dischargeDate)}` : "",
    timeframeText: TIMEFRAME[p.future.timeframe] ?? "",
    weeklyBudget: p.future.weeklyBudget?.toLocaleString("en-NZ") ?? "",
  };
}
export type TemplateContext = ReturnType<typeof templateContext>;

export const fmtDate = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Replace {{path}} placeholders. Unknown paths render as an empty string and are reported, so content errors are caught in tests. */
export function render(text: string, ctx: TemplateContext, missing?: Set<string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = read(ctx, path);
    if (v === undefined || v === null) { missing?.add(path); return ""; }
    return Array.isArray(v) ? list(v.map(String)) : String(v);
  });
}
