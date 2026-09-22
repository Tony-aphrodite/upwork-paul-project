/**
 * Logging that never writes personal information. Only identifiers, counts and timings are allowed through;
 * any other key is dropped, so a careless log call cannot leak a name or a note.
 */
const ALLOWED = new Set(["event", "planId", "profileId", "version", "kind", "pages", "ms", "modules", "actions", "status", "errors", "bytes"]);

export function log(event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = { event, at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) if (ALLOWED.has(k)) safe[k] = v;
  console.info(JSON.stringify(safe));
  return safe;
}
