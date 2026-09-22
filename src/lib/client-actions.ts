"use client";

import { ActionPlan, FamilyProfile } from "./schema";
import { api, workspace, type PlanRecord } from "./workspace";

type Issue = { path: string; message: string };
export type ImportResult = { ok: true; planId: string } | { ok: false; error: string; issues: Issue[] };

export async function createPlan(profile: FamilyProfile, caseId?: string): Promise<string> {
  const { plan } = await api<{ plan: ActionPlan }>("/api/plans/generate", { profile, customModules: workspace.get().customModules, reason: caseId ? "First plan from a test case" : "First plan" });
  const rec: PlanRecord = { planId: plan.planId, caseId, profile, versions: [plan], working: plan };
  workspace.upsert(rec);
  return plan.planId;
}

/** Regenerate from a changed profile. The working copy (with any unsaved progress) is the "previous" plan, so nothing is lost. */
export async function regenerate(rec: PlanRecord, profile: FamilyProfile, reason: string) {
  const { plan } = await api<{ plan: ActionPlan }>("/api/plans/generate", { profile, previous: rec.working, reason, customModules: workspace.get().customModules });
  workspace.upsert({ ...rec, profile, versions: [...rec.versions, plan], working: plan });
  return plan;
}

/** Accepts a Family Profile, or an export bundle { profile, versions } from this console. */
export async function importJson(text: string): Promise<ImportResult> {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: "That is not valid JSON.", issues: [{ path: "", message: (e as Error).message }] }; }
  const obj = raw as Record<string, unknown>;
  if (obj && typeof obj === "object" && "versions" in obj && "profile" in obj) {
    const profile = FamilyProfile.safeParse(obj.profile);
    const versions = ActionPlan.array().min(1).safeParse(obj.versions);
    const issues = [...(profile.success ? [] : profile.error.issues.map((i) => ({ path: `profile.${i.path.join(".")}`, message: i.message }))), ...(versions.success ? [] : versions.error.issues.map((i) => ({ path: `versions.${i.path.join(".")}`, message: i.message })))];
    if (!profile.success || !versions.success) return { ok: false, error: "The export bundle does not match the schemas.", issues };
    const latest = versions.data.at(-1)!;
    workspace.upsert({ planId: latest.planId, profile: profile.data, versions: versions.data, working: latest });
    return { ok: true, planId: latest.planId };
  }
  const profile = FamilyProfile.safeParse(raw);
  if (!profile.success) return { ok: false, error: "This does not match the Family Profile schema.", issues: profile.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  return { ok: true, planId: await createPlan(profile.data) };
}

export function exportBundle(rec: PlanRecord) {
  const blob = new Blob([JSON.stringify({ profile: rec.profile, versions: rec.versions }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${rec.planId}-v${rec.working.version}.json` });
  a.click();
}
