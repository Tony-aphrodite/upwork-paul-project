import modulesJson from "../../content/modules.json";
import sourcesJson from "../../content/sources.json";
import providersJson from "../../content/providers.json";
import { ModuleDefinition, Provider, Source } from "./schema";
import { hash, type Library } from "./engine/generate";

/**
 * The built-in content library, validated when loaded so a broken module file fails loudly at build time.
 * In production these three lists come from the knowledge and provider repositories; the engine only needs the same shapes.
 */
const modules = ModuleDefinition.array().parse(modulesJson);
const sources = Source.array().parse(sourcesJson);
const providers = Provider.array().parse(providersJson);

export const builtInLibrary: Library = { modules, sources, providers, moduleSet: `core-${hash(modules).slice(0, 8)}` };

/** Add or replace modules without touching code: custom modules are validated and merged by id. */
export function withModules(lib: Library, extra: unknown[]): Library {
  const parsed = ModuleDefinition.array().parse(extra);
  const byId = new Map(lib.modules.map((m) => [m.id, m]));
  for (const m of parsed) byId.set(m.id, m);
  const merged = [...byId.values()].sort((a, b) => a.order - b.order);
  return { ...lib, modules: merged, moduleSet: parsed.length ? `custom-${hash(merged).slice(0, 8)}` : lib.moduleSet };
}
