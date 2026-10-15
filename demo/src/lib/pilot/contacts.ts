import { z } from "zod";
import type { Answers } from "../questionnaire/schema";
import { AREAS } from "./care-homes";
import { WebUrl } from "./content";

/**
 * Useful contacts at the end of a plan: organisations from the client's repository (his "Organisations" tab),
 * imported by `npm run contacts:import` into content/pilot/contacts.json. Only how to reach each one is kept: name,
 * phone, email, website, and the areas it serves. His research and verification notes are never imported, and rows
 * his Status Guide says may not be used in an Action Plan ("Review due", "Superseded / do not use") are left out.
 *
 * A contact is linked to plan actions: it shows when one of its actions is in the plan, and disappears when a navigator
 * removes them. A few show on every plan (for example Seniorline). Local organisations show only to families in the
 * areas they serve.
 */

export const Contact = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  phone: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  website: z.union([WebUrl, z.literal("")]).default(""),
  /** The areas (keys of AREAS) it serves; empty: everywhere, a national service. */
  areas: z.array(z.string().refine((a) => a in AREAS, "unknown area")).default([]),
  /** The action keys it is shown with. */
  actions: z.array(z.string()).default([]),
  /** Shown on every plan, whatever the actions. */
  everyPlan: z.boolean().default(false),
});
export type Contact = z.infer<typeof Contact>;

export const Contacts = z.object({
  /** Where the details come from, as the plan states it. */
  source: z.string().min(1).max(300),
  /** The oldest "Last checked" date of the contacts kept (YYYY-MM-DD). */
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contacts: z.array(Contact),
});
export type Contacts = z.infer<typeof Contacts>;

/** One contact as a plan shows it. `actions` are the plan's action keys it goes with; empty means every plan. */
export type PlanContact = { id: string; name: string; phone: string; email: string; website: string; actions: string[]; removed: boolean };

/** Health NZ's Bay of Plenty district: what "Bay of Plenty" means in the coverage column. Rotorua is in Lakes. */
const BAY_OF_PLENTY = ["tauranga", "western_bay_of_plenty", "whakatane", "kawerau", "opotiki"];
const PLACE: Record<string, string[]> = {
  "bay of plenty": BAY_OF_PLENTY, "western bay of plenty": ["western_bay_of_plenty"], wbop: ["western_bay_of_plenty"],
  tauranga: ["tauranga"], whakatane: ["whakatane"], kawerau: ["kawerau"], opotiki: ["opotiki"], rotorua: ["rotorua"],
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The client's "Region / Coverage" text as areas: [] for a national service, or the areas named. Parts are split on
 * "/", "&", ",", ";" and "and"; "relevant to" is ignored. Returns the parts it does not know, so the import can say so.
 */
export function coverageAreas(text: string): { areas: string[]; unknown: string[] } {
  const parts = norm(text).split(/\s*(?:\/|&|,|;|\band\b)\s*/).map((p) => p.replace(/^relevant to /, "").trim()).filter(Boolean);
  if (!parts.length || parts.some((p) => /^(national|new zealand|nz|most of (nz|new zealand))$/.test(p))) return { areas: [], unknown: [] };
  const unknown = parts.filter((p) => !PLACE[p]);
  return { areas: [...new Set(parts.flatMap((p) => PLACE[p] ?? []))], unknown };
}

/** "every plan", or action keys separated by commas, semicolons or spaces. */
export function parseLinks(text: string): { everyPlan: boolean; actions: string[] } {
  if (/^\s*every plan\s*$/i.test(text)) return { everyPlan: true, actions: [] };
  return { everyPlan: false, actions: [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))] };
}

/** The contacts for a plan with these actions, for a family living in the area they chose (q5_town). */
export function pickContacts(data: Contacts, actionKeys: string[], answers: Answers): PlanContact[] {
  const area = typeof answers.q5_town === "string" && answers.q5_town in AREAS ? answers.q5_town : undefined;
  const inPlan = new Set(actionKeys);
  return data.contacts.flatMap((c) => {
    if (c.areas.length && !(area && c.areas.includes(area))) return [];
    const linked = c.actions.filter((k) => inPlan.has(k));
    if (!c.everyPlan && !linked.length) return [];
    return [{ id: c.id, name: c.name, phone: c.phone, email: c.email, website: c.website, actions: c.everyPlan ? [] : linked, removed: false }];
  });
}
