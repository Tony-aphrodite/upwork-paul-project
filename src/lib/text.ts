/** Small text helpers shared by the engine, the renderer and the pages. No server-only imports. */

/** "a, b and c". When an item itself contains a comma, items are separated by semicolons so the list stays readable. */
export function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  const sep = xs.some((x) => x.includes(",")) ? "; " : ", ";
  return `${xs.slice(0, -1).join(sep)}${sep === "; " ? ";" : ""} and ${xs.at(-1)}`;
}

/** A calendar date (YYYY-MM-DD, no time) as "22 September 2026". */
export const fmtDate = (isoDate: string) =>
  new Date(isoDate.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
