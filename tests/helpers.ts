import cases from "../content/cases.json";
import { FamilyProfile } from "../src/lib/schema";
import { builtInLibrary } from "../src/lib/library";
import { generatePlan } from "../src/lib/engine/generate";

export const NOW = new Date("2026-09-22T09:00:00Z");
export const profileOf = (id: string) => FamilyProfile.parse(cases.find((c) => c.id === id)!.profile);
export const planOf = (id: string) => generatePlan(profileOf(id), builtInLibrary, { now: NOW, planId: "AP-TEST01" });
export const CASE_IDS = cases.map((c) => c.id);
