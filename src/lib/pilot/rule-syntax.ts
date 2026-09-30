import type { Condition } from "../schema";
import type { QuestionDefinition } from "../questionnaire/schema";

/**
 * The condition language of the content spreadsheet. It is written by the Ageing Navigator team, so it reads like a
 * sentence and every mistake gets a plain message:
 *
 *   q8 has memory_or_thinking              a multiple-choice answer includes this option
 *   q8 has any falls, memory_or_thinking   includes at least one of these
 *   q8 has all falls, transport            includes every one of these
 *   q19 is completed                       a single-choice answer is this option
 *   q19 is not completed
 *   q19 in completed, receiving            is one of these
 *   q19 not in none, unsure
 *   q21.epoa_property is no                one row of a grid question
 *   q11a answered / q11a not answered      any answer at all, or none
 *
 * combined with `and`, `or`, `not` and brackets; `and` binds tighter than `or`.
 * The result is the same declarative Condition the questionnaire already uses, read over the answers.
 */

export class RuleError extends Error {}

type Tok = { kind: "word" | "comma" | "open" | "close"; text: string; at: number };
const KEYWORDS = new Set(["and", "or", "not", "is", "in", "has", "any", "all", "answered"]);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ",") { out.push({ kind: "comma", text: c, at: i }); i++; continue; }
    if (c === "(") { out.push({ kind: "open", text: c, at: i }); i++; continue; }
    if (c === ")") { out.push({ kind: "close", text: c, at: i }); i++; continue; }
    const m = /^[A-Za-z0-9_.]+/.exec(src.slice(i));
    if (!m) throw new RuleError(`"${c}" cannot be used in a condition (position ${i + 1}). Use question IDs, option values, commas and brackets.`);
    out.push({ kind: "word", text: m[0], at: i });
    i += m[0].length;
  }
  return out;
}

export type QuestionLookup = Map<string, QuestionDefinition>;

class Parser {
  private i = 0;
  constructor(private toks: Tok[], private qs?: QuestionLookup) {}

  parse(): Condition {
    if (!this.toks.length) throw new RuleError("The condition is empty.");
    const c = this.or();
    if (this.i < this.toks.length) throw new RuleError(`Unexpected "${this.toks[this.i].text}". Join conditions with "and" or "or".`);
    return c;
  }

  private peek(word?: string) {
    const t = this.toks[this.i];
    if (!t) return undefined;
    if (word === undefined) return t;
    return t.kind === "word" && t.text.toLowerCase() === word ? t : undefined;
  }
  private take(word: string) { if (this.peek(word)) { this.i++; return true; } return false; }

  private or(): Condition {
    const parts = [this.and()];
    while (this.take("or")) parts.push(this.and());
    return parts.length === 1 ? parts[0] : { any: parts };
  }

  private and(): Condition {
    const parts = [this.unary()];
    while (this.take("and")) parts.push(this.unary());
    return parts.length === 1 ? parts[0] : { all: parts };
  }

  private unary(): Condition {
    if (this.take("not")) return { not: this.unary() };
    const t = this.peek();
    if (!t) throw new RuleError("The condition ends too early.");
    if (t.kind === "open") {
      this.i++;
      const inner = this.or();
      if (this.peek()?.kind !== "close") throw new RuleError("A bracket is not closed.");
      this.i++;
      return inner;
    }
    return this.test();
  }

  private word(what: string): string {
    const t = this.toks[this.i];
    if (!t || t.kind !== "word") throw new RuleError(`Expected ${what}${t ? ` but found "${t.text}"` : " at the end"}.`);
    this.i++;
    return t.text;
  }

  private values(): string[] {
    const out = [this.value()];
    while (this.peek()?.kind === "comma") { this.i++; out.push(this.value()); }
    return out;
  }

  private value(): string {
    const v = this.word("an option value");
    if (KEYWORDS.has(v.toLowerCase())) throw new RuleError(`Expected an option value but found "${v}".`);
    return v;
  }

  private test(): Condition {
    const field = this.word("a question ID");
    if (KEYWORDS.has(field.toLowerCase())) throw new RuleError(`Expected a question ID but found "${field}".`);
    const q = this.question(field);
    if (this.take("answered")) return { field, op: "truthy" };
    if (this.take("not")) {
      if (this.take("answered")) return { field, op: "falsy" };
      if (this.take("in")) return { not: { field, op: "in", value: this.checked(q, field, "in", this.values()) } };
      throw new RuleError(`After "${field} not", write "answered" or "in".`);
    }
    if (this.take("is")) {
      if (this.take("not")) return { field, op: "neq", value: this.checked(q, field, "is", [this.value()])[0] };
      return { field, op: "eq", value: this.checked(q, field, "is", [this.value()])[0] };
    }
    if (this.take("in")) return { field, op: "in", value: this.checked(q, field, "in", this.values()) };
    if (this.take("has")) {
      const mode = this.take("any") ? "any" : this.take("all") ? "all" : "one";
      const vals = this.checked(q, field, "has", mode === "one" ? [this.value()] : this.values());
      const parts: Condition[] = vals.map((value) => ({ field, op: "includes", value }));
      if (parts.length === 1) return parts[0];
      return mode === "all" ? { all: parts } : { any: parts };
    }
    const next = this.peek();
    throw new RuleError(`After "${field}", write is, in, has or answered${next ? ` (found "${next.text}")` : ""}.`);
  }

  private question(field: string): { q: QuestionDefinition; item?: string } | undefined {
    if (!this.qs) return undefined;
    const [id, item, extra] = field.split(".");
    const q = this.qs.get(id);
    if (!q || extra !== undefined) throw new RuleError(`There is no question "${field}".`);
    if (item !== undefined) {
      if (q.type !== "tri_grid") throw new RuleError(`"${field}": only grid questions have rows, and ${id} is not a grid.`);
      if (!q.items.some((r) => r.id === item)) throw new RuleError(`"${item}" is not a row of ${id}. Rows: ${q.items.map((r) => r.id).join(", ")}.`);
    }
    return { q, item };
  }

  private checked(found: { q: QuestionDefinition; item?: string } | undefined, field: string, op: "is" | "in" | "has", vals: string[]): string[] {
    if (!found) return vals;
    const { q, item } = found;
    const kind = q.type === "tri_grid" ? (item ? "single" : "grid") : q.type;
    if (op === "has" && kind !== "multi") throw new RuleError(`"has" works with multiple-choice questions, and ${field} is not one. Use "is" or "in".`);
    if (op !== "has" && kind === "multi") throw new RuleError(`${field} is multiple choice: use "has" instead of "${op}".`);
    if (kind === "grid") throw new RuleError(`${field} is a grid: name a row, for example ${q.id}.${q.items[0]?.id ?? "row"}.`);
    if (kind === "short" || kind === "long") throw new RuleError(`${field} is a text question: use "answered" or "not answered".`);
    const allowed = new Set(q.options.map((o) => o.value));
    for (const v of vals) {
      if (!allowed.has(v)) {
        const list = [...allowed];
        throw new RuleError(`"${v}" is not an option of ${q.id}. Options: ${list.slice(0, 12).join(", ")}${list.length > 12 ? ", …" : ""}.`);
      }
    }
    return vals;
  }
}

/** Text to Condition. With `questions`, every question ID, row and option value is checked against the questionnaire. */
export function parseRule(text: string, questions?: QuestionLookup): Condition {
  return new Parser(tokenize(text.trim()), questions).parse();
}

/* ------------------------------ Condition back to text, for the pre-filled spreadsheet ------------------------------ */

const isComposite = (c: Condition) => "all" in c || "any" in c;

/** The includes-parts of an any/all that all read the same field, so they print as "has any a, b". */
function sameFieldIncludes(parts: Condition[]): { field: string; values: string[] } | undefined {
  if (parts.length < 2) return undefined;
  const fields = new Set<string>();
  const values: string[] = [];
  for (const p of parts) {
    if (!("field" in p) || p.op !== "includes") return undefined;
    fields.add(p.field);
    values.push(String(p.value));
  }
  return fields.size === 1 ? { field: [...fields][0], values } : undefined;
}

export function ruleToText(c: Condition): string {
  if ("any" in c) {
    const same = sameFieldIncludes(c.any);
    if (same) return `${same.field} has any ${same.values.join(", ")}`;
    return c.any.map((x) => ("all" in x && !sameFieldIncludes(x.all) ? `(${ruleToText(x)})` : ruleToText(x))).join(" or ");
  }
  if ("all" in c) {
    const same = sameFieldIncludes(c.all);
    if (same) return `${same.field} has all ${same.values.join(", ")}`;
    return c.all.map((x) => ("any" in x && !sameFieldIncludes(x.any) ? `(${ruleToText(x)})` : ruleToText(x))).join(" and ");
  }
  if ("not" in c) {
    const inner = c.not;
    if ("field" in inner && inner.op === "in") return `${inner.field} not in ${(inner.value as string[]).join(", ")}`;
    return isComposite(inner) ? `not (${ruleToText(inner)})` : `not ${ruleToText(inner)}`;
  }
  switch (c.op) {
    case "eq": return `${c.field} is ${c.value}`;
    case "neq": return `${c.field} is not ${c.value}`;
    case "in": return `${c.field} in ${(c.value as string[]).join(", ")}`;
    case "includes": return `${c.field} has ${c.value}`;
    case "truthy": case "exists": return `${c.field} answered`;
    case "falsy": return `${c.field} not answered`;
    default: throw new RuleError(`The operator "${c.op}" has no spreadsheet form.`);
  }
}
