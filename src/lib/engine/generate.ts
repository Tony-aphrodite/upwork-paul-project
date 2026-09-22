import { PRIORITIES, SCHEMA_VERSION, type Action, type ActionPlan, type ChangeSet, type FamilyProfile, type ModuleDefinition, type PlanModule, type Priority, type Provider, type ProviderMatch, type Source } from "../schema";
import { test } from "./conditions";
import { render, templateContext } from "./context";
import { situation } from "./summary";

export const ENGINE_VERSION = "0.1.0";
const rank = (p: Priority) => PRIORITIES.indexOf(p);

/** Stable, dependency-free hash (cyrb53) so the same profile always gives the same fingerprint in browser and server. */
export function hash(value: unknown): string {
  const str = JSON.stringify(value, Object.keys(flatKeys(value)).sort());
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
function flatKeys(v: unknown, acc: Record<string, true> = {}): Record<string, true> {
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { acc[k] = true; flatKeys(x, acc); }
  return acc;
}

export type Library = { modules: ModuleDefinition[]; sources: Source[]; providers: Provider[]; moduleSet: string };
export type GenerateOptions = { now?: Date; previous?: ActionPlan; reason?: string; planId?: string; questionnaireVersion?: string };

/** Which modules apply, at what priority. Exposed separately so the decision logic can be tested and explained. */
export function relevantModules(profile: FamilyProfile, modules: ModuleDefinition[]) {
  return modules
    .filter((m) => test(m.when, profile))
    .map((m) => ({ def: m, level: (m.priority.rules.find((r) => test(r.when, profile))?.level ?? m.priority.default) as Priority }))
    .sort((a, b) => rank(a.level) - rank(b.level) || a.def.order - b.def.order);
}

const PRICE_CEILING: Record<string, number> = { under_400k: 400_000, "400k_600k": 600_000, "600k_800k": 800_000, "800k_1m": 1_000_000, over_1m: Number.MAX_SAFE_INTEGER };
const ACCOMMODATION: Record<string, string> = { villa: "villa", apartment: "apartment", serviced_apartment: "serviced apartment", care_suite: "care suite" };

/**
 * Transparent matching: every option lists which of the family's criteria it meets, misses or cannot confirm.
 * Nothing is ranked because a provider pays, and a record with no verification date says so rather than looking current.
 */
export function matchProviders(profile: FamilyProfile, providers: Provider[], moduleId: string, types: string[]): ProviderMatch[] {
  const needsDementia = profile.cognition.diagnosis === "dementia" || profile.cognition.concern === "significant";
  const v = profile.village;
  const wantedTypes = (v?.accommodationTypes ?? []).filter((t) => t !== "open");
  const ceiling = v && v.priceBand !== "unknown" && v.priceBand !== "prefer_not_to_say" ? PRICE_CEILING[v.priceBand] : undefined;
  const wantsPets = (v?.mattersMost ?? []).some((m) => /pets/i.test(m));
  const wantsOnSiteCare = v?.onSiteCare === "essential" || v?.onSiteCare === "important";
  const otherPreferences = (v?.mattersMost ?? []).filter((m) => !/pets/i.test(m));

  return providers.filter((p) => types.includes(p.type)).map((p) => {
    const matched: string[] = [], notMatched: string[] = [], unknown: string[] = [];
    (p.regions.includes(profile.person.region) ? matched : notMatched).push(`Location: ${profile.person.region}`);
    if (v?.locationPreference === "particular_area" && v.preferredArea) (p.town && v.preferredArea.toLowerCase().includes(p.town.toLowerCase()) ? matched : unknown).push(`Preferred area: ${v.preferredArea}`);
    if (profile.funding.assessedLevel && p.careLevels.length) (p.careLevels.includes(profile.funding.assessedLevel) ? matched : notMatched).push(`Care level: ${profile.funding.assessedLevel.replace("_", " ")}`);
    if (needsDementia && p.dementiaSupport !== undefined) (p.dementiaSupport ? matched : notMatched).push("Dementia support");
    // The village questions only make sense for somewhere to live, so they are not held against a home-care or equipment provider.
    const isResidence = p.type === "retirement_village" || p.type === "residential_care";
    if (isResidence && wantedTypes.length) {
      if (!p.accommodationTypes.length) unknown.push(`Accommodation type: ${wantedTypes.map((t) => ACCOMMODATION[t]).join(" or ")} not confirmed`);
      else {
        const shared = wantedTypes.filter((t) => p.accommodationTypes.includes(t as (typeof p.accommodationTypes)[number]));
        (shared.length ? matched : notMatched).push(`Accommodation: ${(shared.length ? shared : wantedTypes).map((t) => ACCOMMODATION[t]).join(", ")}`);
      }
    }
    if (isResidence && wantsOnSiteCare) (p.careLevels.length ? matched : notMatched).push(p.careLevels.length ? `Care on site: ${p.careLevels.map((c) => c.replace("_", " ")).join(", ")}` : "Higher levels of care on the same site");
    if (isResidence && wantsPets) p.petsAllowed === undefined ? unknown.push("Pets not confirmed") : (p.petsAllowed ? matched : notMatched).push("Pets allowed");
    if (isResidence && ceiling !== undefined) {
      if (p.purchaseFrom === undefined) unknown.push("Purchase price not confirmed");
      else (p.purchaseFrom <= ceiling ? matched : notMatched).push(`Entry price from $${p.purchaseFrom.toLocaleString("en-NZ")}`);
    }
    for (const want of otherPreferences) if (p.features.some((f) => f.toLowerCase() === want.toLowerCase())) matched.push(want);
    if (profile.future.weeklyBudget !== undefined && p.weeklyCostFrom !== undefined) (p.weeklyCostFrom <= profile.future.weeklyBudget ? matched : notMatched).push(`Budget: up to $${profile.future.weeklyBudget.toLocaleString("en-NZ")} a week`);
    if (p.availability === "available") matched.push("Availability: vacancy or capacity now");
    else if (p.availability === "waitlist") notMatched.push("Availability: waiting list");
    else unknown.push("Availability not confirmed");
    if (!p.verifiedOn) unknown.push("We have not confirmed this information recently");
    return { providerId: p.id, name: p.name, type: p.type, moduleId, matched, notMatched, unknown, verifiedOn: p.verifiedOn };
  }).filter((m) => m.matched.some((x) => x.startsWith("Location")))
    .sort((a, b) => b.matched.length - a.matched.length || a.notMatched.length - b.notMatched.length)
    .slice(0, 3);
}

export function diff(prev: ActionPlan | undefined, next: Pick<ActionPlan, "actions" | "modules">): ChangeSet {
  const before = new Map((prev?.actions ?? []).filter((a) => a.status !== "no_longer_required").map((a) => [a.key, a]));
  const after = new Map(next.actions.filter((a) => a.status !== "no_longer_required").map((a) => [a.key, a]));
  const fields = ["title", "priority", "timing", "responsible", "status", "notes"] as const;
  const prevMods = new Set(prev?.modules.map((m) => m.id) ?? []), nextMods = new Set(next.modules.map((m) => m.id));
  return {
    added: [...after.keys()].filter((k) => !before.has(k)),
    removed: [...before.keys()].filter((k) => !after.has(k)),
    changed: [...after.entries()].filter(([k]) => before.has(k)).map(([k, a]) => ({ key: k, fields: fields.filter((f) => before.get(k)![f] !== a[f]) })).filter((c) => c.fields.length),
    modulesAdded: [...nextMods].filter((m) => !prevMods.has(m)),
    modulesRemoved: [...prevMods].filter((m) => !nextMods.has(m)),
  };
}

/**
 * Q18A: "The Action Plan should flag these separately from ordinary planning recommendations."
 * These items are not turned into ordinary actions; they are shown first, with who to contact today.
 */
export function urgentBlock(profile: FamilyProfile): ActionPlan["summary"]["urgent"] {
  const u = profile.urgent;
  if (!u || u.level === "no" || (u.flags.length === 0 && !u.detail.trim())) return undefined;
  const items = [...u.flags, ...(u.detail.trim() ? [u.detail.trim()] : [])];
  const safeguarding = u.flags.some((f) => /neglect|abuse|exploitation/i.test(f));
  const guidance = [
    u.level === "yes" ? "You told us something may need urgent attention." : u.level === "possibly" ? "You told us something may possibly need urgent attention." : "You were not sure whether something needs urgent attention.",
    "Please raise these with their GP or the hospital team first, and with the needs assessment service if one is involved.",
    safeguarding ? "For concerns about neglect, abuse or exploitation, contact the Elder Abuse Response Service on 0800 32 668 65 (0800 EA NOT OK)." : "",
    "If someone is in immediate danger or needs urgent medical attention, call 111.",
  ].filter(Boolean).join(" ");
  return { level: u.level, items, guidance };
}

export const nextVersion = (v?: string) => { if (!v) return "1.0"; const [a, b] = v.split(".").map(Number); return `${a}.${b + 1}`; };
const newPlanId = () => `AP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/**
 * Profile + module library (+ the previous version) → a structured Action Plan.
 * The previous version's progress is kept: status, notes and a changed responsible person carry over by action key,
 * and actions that are no longer indicated stay on record as "No longer required" instead of vanishing.
 */
export function generatePlan(profile: FamilyProfile, lib: Library, opts: GenerateOptions = {}): ActionPlan {
  const now = (opts.now ?? new Date()).toISOString();
  const prev = opts.previous;
  const ctx = templateContext(profile);
  const missing = new Set<string>();
  const r = (s: string) => render(s, ctx, missing);
  const prevActions = new Map(prev?.actions.map((a) => [a.key, a]) ?? []);

  const chosen = relevantModules(profile, lib.modules);
  const modules: PlanModule[] = [];
  const actions: Action[] = [];
  const providerMatches: ProviderMatch[] = [];

  for (const { def, level } of chosen) {
    const keys: string[] = [];
    for (const a of def.actions.filter((x) => test(x.when, profile))) {
      const key = `${def.id}:${a.id}`;
      // An action can state its own urgency (fitting smoke alarms is urgent even in a "soon" module); otherwise it follows the module.
      const priority: Priority = a.priority ?? level;
      const old = prevActions.get(key);
      const fresh: Action = { key, title: r(a.title), description: r(a.description), priority, timing: r(a.timing), responsible: r(a.responsible), status: "not_started", moduleId: def.id, source: "rules", notes: "", createdAt: now, updatedAt: now };
      const merged: Action = old ? { ...fresh, status: old.status === "no_longer_required" ? "not_started" : old.status, notes: old.notes, responsible: old.responsible || fresh.responsible, source: old.source, createdAt: old.createdAt } : fresh;
      if (old) merged.updatedAt = (["title", "priority", "timing", "status"] as const).some((f) => old[f] !== merged[f]) ? now : old.updatedAt;
      actions.push(merged);
      keys.push(key);
    }
    const info = def.information.filter((i) => test(i.when, profile)).map((i) => ({ title: r(i.title), body: r(i.body), sourceId: i.sourceId }));
    modules.push({
      id: def.id,
      title: r(def.title),
      priority: level,
      noticed: def.noticed.filter((n) => test(n.when, profile)).map((n) => r(n.text)),
      whyItMatters: def.whyItMatters ? r(def.whyItMatters) : undefined,
      whoCanHelp: def.whoCanHelp.map(r),
      questions: def.questions.filter((q) => test(q.when, profile)).map((q) => ({ for: q.for, question: r(q.question) })),
      usefulInformation: info,
      sourceIds: [...new Set(info.map((i) => i.sourceId).filter(Boolean) as string[])],
      actionKeys: keys,
    });
    if (def.providerTypes.length) providerMatches.push(...matchProviders(profile, lib.providers, def.id, def.providerTypes));
  }

  // Actions added by a navigator, the family or AI are never dropped by regeneration; rule actions that no longer apply are retired, not deleted.
  for (const old of prev?.actions ?? []) {
    if (actions.some((a) => a.key === old.key)) continue;
    if (old.source !== "rules") { actions.push(old); continue; }
    actions.push(old.status === "completed" || old.status === "no_longer_required" ? old : { ...old, status: "no_longer_required", notes: [old.notes, `No longer indicated after the update on ${now.slice(0, 10)}.`].filter(Boolean).join(" "), updatedAt: now });
  }
  actions.sort((a, b) => rank(a.priority) - rank(b.priority) || chosen.findIndex((c) => c.def.id === a.moduleId) - chosen.findIndex((c) => c.def.id === b.moduleId));

  const live = actions.filter((a) => a.status !== "completed" && a.status !== "no_longer_required");
  const priorities = chosen.slice(0, 5).filter((c, i) => i < 3 || c.level !== "plan_ahead").map(({ def, level }) => {
    const mod = modules.find((m) => m.id === def.id)!;
    return { moduleId: def.id, title: r(def.headline), why: mod.noticed[0] ?? "", level };
  });
  const usedSources = new Set(modules.flatMap((m) => m.sourceIds));
  if (missing.size) throw new Error(`Template fields not found: ${[...missing].join(", ")}`);

  const plan: ActionPlan = {
    schemaVersion: SCHEMA_VERSION,
    planId: prev?.planId ?? opts.planId ?? newPlanId(),
    profileId: profile.profileId,
    version: nextVersion(prev?.version),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    generatedBy: { engine: "kinfield-rules", engineVersion: ENGINE_VERSION, moduleSet: lib.moduleSet, questionnaireVersion: opts.questionnaireVersion ?? prev?.generatedBy.questionnaireVersion ?? (profile.extra as { questionnaireVersion?: string })?.questionnaireVersion },
    profileHash: hash(profile),
    summary: {
      situation: situation(profile),
      attention: chosen.filter((c) => c.level === "now").map((c) => r(c.def.headline)),
      nextStep: live[0] ? `${live[0].title} (${live[0].timing.toLowerCase()})` : "Review this plan with your Kinfield navigator.",
      urgent: urgentBlock(profile),
    },
    priorities,
    modules,
    actions,
    providerMatches,
    sources: lib.sources.filter((s) => usedSources.has(s.id)),
    history: [],
  };
  plan.history = [...(prev?.history ?? []), { version: plan.version, at: now, reason: opts.reason ?? (prev ? "Updated" : "First plan"), changes: prev ? diff(prev, plan) : undefined }];
  return plan;
}

/** Save progress (status, notes, who is responsible) as a new version without regenerating from the profile. */
export function saveProgress(plan: ActionPlan, previous: ActionPlan, reason: string, now = new Date()): ActionPlan {
  const at = now.toISOString();
  const version = nextVersion(previous.version);
  const changes = diff(previous, plan);
  return { ...plan, version, updatedAt: at, history: [...previous.history, { version, at, reason, changes }] };
}
