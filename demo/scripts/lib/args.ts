/** Tiny --flag value parser for the scripts. */
export function args(argv = process.argv.slice(2)) {
  const out: Record<string, string | true> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
    } else rest.push(a);
  }
  return { flags: out, rest };
}
