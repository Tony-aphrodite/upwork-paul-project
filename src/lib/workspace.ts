"use client";

import { useSyncExternalStore } from "react";
import type { ActionPlan, FamilyProfile } from "./schema";

/**
 * Demo storage: the test console keeps its fictional plans in this browser only (localStorage), because the demo has
 * no database. Production swaps this for the PlanRepository described in the docs (Postgres, encrypted at rest):
 * the same shape, one record per plan with immutable versions.
 */
export type PlanRecord = { planId: string; caseId?: string; profile: FamilyProfile; versions: ActionPlan[]; working: ActionPlan };
export type Workspace = { plans: Record<string, PlanRecord>; customModules: unknown[] };

const KEY = "kinfield-workspace-v1";
const EMPTY: Workspace = { plans: {}, customModules: [] };
let cache: Workspace | null = null;
const listeners = new Set<() => void>();

function load(): Workspace {
  if (cache) return cache;
  try { cache = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "null") }; } catch { cache = EMPTY; }
  return cache!;
}
function save(next: Workspace) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or blocked: keep in memory */ }
  listeners.forEach((l) => l());
}

export const workspace = {
  get: load,
  update(fn: (w: Workspace) => Workspace) { save(fn(load())); },
  upsert(rec: PlanRecord) { save({ ...load(), plans: { ...load().plans, [rec.planId]: rec } }); },
  remove(planId: string) { const { [planId]: _, ...rest } = load().plans; save({ ...load(), plans: rest }); },
  clear() { save(EMPTY); },
};

export function useWorkspace(): Workspace | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); const on = (e: StorageEvent) => { if (e.key === KEY) { cache = null; l(); } }; window.addEventListener("storage", on); return () => { listeners.delete(l); window.removeEventListener("storage", on); }; },
    load,
    () => null,
  );
}

/** Client helpers for the API. Errors come back as { error, details } with field paths. */
export async function api<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (res.status === 401) { window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`; throw new Error("Signed out"); }
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Request failed"), { details: json.details });
  return json as T;
}

export async function downloadPdf(kind: "plan" | "summary", plan: ActionPlan, profile: FamilyProfile) {
  const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, plan, profile }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "The PDF could not be created");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "plan.pdf" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return Number(res.headers.get("X-Pages") ?? 0);
}
