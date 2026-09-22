import type { Condition } from "../schema";

/** Read a dotted path such as "support.mainCarer.strain". Missing segments give undefined. */
export function read(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o != null && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== false && v !== "" && v !== 0);

/**
 * Evaluate a declarative condition. Modules are data, so there is no eval and no code in content:
 * only these operators, which the module schema validates.
 */
export function test(c: Condition | undefined, data: unknown): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => test(x, data));
  if ("any" in c) return c.any.some((x) => test(x, data));
  if ("not" in c) return !test(c.not, data);
  const v = read(data, c.field);
  switch (c.op) {
    case "eq": return v === c.value;
    case "neq": return v !== c.value;
    case "in": return Array.isArray(c.value) && c.value.includes(v);
    case "gte": return typeof v === "number" && v >= (c.value as number);
    case "lte": return typeof v === "number" && v <= (c.value as number);
    case "truthy": return truthy(v);
    case "falsy": return !truthy(v);
    case "includes": return Array.isArray(v) && v.includes(c.value);
    case "exists": return v !== undefined && v !== null;
  }
}

/** Every field path a condition reads, used to check module content against the profile schema. */
export function fieldsOf(c: Condition | undefined): string[] {
  if (!c) return [];
  if ("all" in c) return c.all.flatMap(fieldsOf);
  if ("any" in c) return c.any.flatMap(fieldsOf);
  if ("not" in c) return fieldsOf(c.not);
  return [c.field];
}
