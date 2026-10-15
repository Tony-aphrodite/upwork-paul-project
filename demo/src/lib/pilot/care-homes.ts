import { z } from "zod";
import type { Answers } from "../questionnaire/schema";

/**
 * Care homes that may suit, for the plan's residential pathway. The list is the client's own repository (his "BOP Care
 * Homes" tab: Ministry of Health certified homes, with the care each offers), imported by `npm run care-homes:import`
 * into content/pilot/care-homes.json. Only public facts are kept: name, operator, place, levels of care. Prices and
 * vacancies are never imported or shown.
 *
 * Matching is transparent and never decides anything for the family:
 * - the level of care is the one the family reports from an assessment (q19_level); without one, homes offering any
 *   residential care are listed with the levels each offers;
 * - the area is where they live (q5_town): homes there first, then in neighbouring areas, never further away;
 * - when more homes fit than are shown, the choice varies from family to family (a seed from their answers), so no
 *   home is favoured by its name or its place in the list.
 */

export const CARE_LEVELS = ["rest_home", "hospital", "dementia", "psychogeriatric"] as const;
export type CareLevel = (typeof CARE_LEVELS)[number];
export const CARE_LEVEL_LABEL: Record<CareLevel, string> = {
  rest_home: "Rest home care", hospital: "Hospital-level care", dementia: "Dementia care", psychogeriatric: "Psychogeriatric care",
};

/** The Bay of Plenty areas of the q5_town drop-down: how plans name them, the district in the client's data, neighbours. */
export const AREAS: Record<string, { label: string; district: string; near: string[] }> = {
  tauranga: { label: "Tauranga", district: "Tauranga", near: ["western_bay_of_plenty"] },
  western_bay_of_plenty: { label: "the Western Bay of Plenty", district: "Western Bay of Plenty", near: ["tauranga"] },
  whakatane: { label: "Whakatāne", district: "Whakatane", near: ["kawerau", "opotiki"] },
  kawerau: { label: "Kawerau", district: "Kawerau", near: ["whakatane"] },
  opotiki: { label: "Ōpōtiki", district: "Opotiki", near: ["whakatane"] },
  rotorua: { label: "Rotorua", district: "Rotorua", near: [] },
};
/** How many homes a plan shows at most. */
export const MAX_HOMES = 3;

export const CareHome = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  operator: z.string().max(200).default(""),
  area: z.string().refine((a) => a in AREAS, "unknown area"),
  locality: z.string().max(120).default(""),
  address: z.string().max(300).default(""),
  levels: z.array(z.enum(CARE_LEVELS)).min(1),
  respite: z.boolean().default(false),
  villageOnSite: z.boolean().default(false),
  /** Phone or website, when the client's list has one. */
  contact: z.string().max(300).default(""),
});
export type CareHome = z.infer<typeof CareHome>;

export const CareHomes = z.object({
  /** Where the list comes from, as the plan states it. */
  source: z.string().min(1).max(300),
  /** The date the client last checked the list (YYYY-MM-DD). */
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  homes: z.array(CareHome),
});
export type CareHomes = z.infer<typeof CareHomes>;

/** One home as a plan shows it. Removing it on the review screen keeps it, marked removed, like other plan items. */
export type PlanCareHome = {
  id: string; name: string; place: string; address: string; levels: string[]; respite: boolean; villageOnSite: boolean;
  contact: string; why: string[]; removed: boolean;
};

/** A stable number for a string (FNV-1a), to vary the choice between equally suitable homes without favouring any. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

export function matchCareHomes(data: CareHomes, answers: Answers, seed: string): { homes: PlanCareHome[]; level?: CareLevel } {
  const areaKey = typeof answers.q5_town === "string" ? answers.q5_town : "";
  const area = AREAS[areaKey];
  if (!area) return { homes: [] };
  const reported = answers.q19_level;
  const level = (CARE_LEVELS as readonly string[]).includes(reported as string) ? (reported as CareLevel) : undefined;
  const tier = (h: CareHome) => (h.area === areaKey ? 0 : area.near.includes(h.area) ? 1 : -1);
  const homes = data.homes
    .filter((h) => tier(h) >= 0 && (!level || h.levels.includes(level)))
    .sort((a, b) => tier(a) - tier(b) || hash(seed + a.id) - hash(seed + b.id))
    .slice(0, MAX_HOMES)
    .map((h): PlanCareHome => {
      const there = AREAS[h.area];
      return {
        id: h.id, name: h.name, place: [h.locality, there.label.replace(/^the /, "")].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", "),
        address: h.address, levels: h.levels.map((l) => CARE_LEVEL_LABEL[l]), respite: h.respite, villageOnSite: h.villageOnSite, contact: h.contact,
        why: [
          ...(level ? [`Offers ${CARE_LEVEL_LABEL[level].toLowerCase()}, the level you told us about`] : []),
          tier(h) === 0 ? `In ${area.label}, where they live` : `Near ${area.label}, in ${there.label}`,
        ],
        removed: false,
      };
    });
  return { homes, level };
}

/** "12 October 2026" for the source line. */
export const checkedOnText = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
