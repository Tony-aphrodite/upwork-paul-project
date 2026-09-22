import type { Condition } from "./schema";

const OP: Record<string, string> = { eq: "is", neq: "is not", in: "is one of", gte: "is at least", lte: "is at most", truthy: "is set", falsy: "is not set", includes: "includes", exists: "exists" };
const nice = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v.replace(/_/g, " ") : String(v));

/** Conditions in plain English, so reviewers can check the rules without reading JSON. */
export function describe(c: Condition | undefined, depth = 0): string {
  if (!c) return "always";
  if ("all" in c) return c.all.length === 1 ? describe(c.all[0], depth) : `${depth ? "(" : ""}${c.all.map((x) => describe(x, depth + 1)).join(" AND ")}${depth ? ")" : ""}`;
  if ("any" in c) return c.any.length === 1 ? describe(c.any[0], depth) : `${depth ? "(" : ""}${c.any.map((x) => describe(x, depth + 1)).join(" OR ")}${depth ? ")" : ""}`;
  if ("not" in c) return `NOT ${describe(c.not, depth + 1)}`;
  return `${c.field} ${OP[c.op]}${["truthy", "falsy", "exists"].includes(c.op) ? "" : ` ${nice(c.value)}`}`;
}
