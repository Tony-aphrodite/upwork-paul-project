import type { FamilyProfile } from "../schema";
import { list, templateContext } from "./context";

const LIVING: Record<string, string> = { alone: "lives alone", with_partner: "lives with their partner", with_family: "lives with family", retirement_village: "lives in a retirement village", residential_care: "lives in residential care", other: "has another living arrangement" };
const HOME: Record<string, string> = { house: "a house", unit: "a unit", apartment: "an apartment", village_unit: "a village unit", care_facility: "a care facility" };
const MOBILITY: Record<string, string> = { independent: "walks independently", uses_aid: "walks with an aid", needs_help: "needs help to move around", wheelchair: "uses a wheelchair" };
const COG: Record<string, string> = { mild: "some mild memory changes", moderate: "noticeable memory changes", significant: "significant memory and thinking changes" };

/** "What you told us": plain sentences built from the structured profile, in the same order as the questionnaire. */
export function situation(p: FamilyProfile): string[] {
  const c = templateContext(p);
  const out = [`${c.fullName}, ${p.person.age}, ${LIVING[p.living.situation]} in ${HOME[p.living.homeType]} in ${p.person.town}.`];
  if (p.partner) out.push(`${p.partner.name} (${p.partner.age}) is ${p.partner.health === "well" ? "well" : p.partner.health === "unwell" ? "unwell" : "managing some health concerns"}.`);
  out.push(`${c.name} ${MOBILITY[p.mobility.level]}${p.mobility.fallsLast12Months ? ` and has had ${c.falls} in the past year` : ""}.`);
  if (p.health.conditions.length) out.push(`Health conditions include ${list(p.health.conditions.map((x) => x.toLowerCase()))}.`);
  if (p.cognition.concern !== "none") out.push(`The family has noticed ${COG[p.cognition.concern]}${p.cognition.diagnosis === "dementia" ? ", and there is a dementia diagnosis" : ""}.`);
  if (p.hospital.status !== "none") out.push(p.hospital.status === "in_hospital" ? `${c.name} is currently in hospital${c.hospitalReason}.` : `${c.name} was recently discharged from hospital${c.hospitalReason}.`);
  out.push(`Current support: ${c.supportSummary}.`);
  if (p.support.mainCarer) out.push(`${p.support.mainCarer.name} (${p.support.mainCarer.relationship}) is the main carer and describes the strain as ${p.support.mainCarer.strain}.`);
  if (p.goals.length) out.push(`What matters most: ${c.goals}.`);
  if (p.notes.trim()) out.push(`Notes from the family: ${p.notes.trim()}`);
  return out;
}
