import { MIGRATIONS } from "./migrations";

/**
 * The one way the app reaches the database. Production and staging use Postgres through DATABASE_URL (Supabase in
 * Sydney, through its transaction pooler, so prepared statements are off). Without DATABASE_URL, and never on
 * Vercel, a local PGlite database (Postgres compiled to WebAssembly) is used, so development and tests run the same
 * SQL with nothing to install. Parameters are always positional ($1, $2 …); JSON goes in as text cast to jsonb.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Several statements, no parameters: migrations only. */
  exec(text: string): Promise<void>;
  tx<R>(fn: (db: Db) => Promise<R>): Promise<R>;
  readonly kind: "postgres" | "pglite";
}

const g = globalThis as unknown as { __anDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__anDb) g.__anDb = open().catch((e) => { g.__anDb = undefined; throw e; });
  return g.__anDb;
}

/** Tests give each suite its own in-memory database. */
export function useDb(next: Promise<Db> | undefined) { g.__anDb = next; }

export const usingLocalDb = () => !process.env.DATABASE_URL;

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return openPostgres(url);
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set");
  return openPglite(process.env.PGLITE_DIR ?? ".data/pglite");
}

async function openPostgres(url: string): Promise<Db> {
  const postgres = (await import("postgres")).default;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ...(local || /sslmode=/.test(url) ? {} : { ssl: "require" as const }), onnotice: () => undefined });
  type Runner = { unsafe: (text: string, params?: never[]) => PromiseLike<unknown> };
  const wrap = (s: Runner, inTx: boolean): Db => ({
    kind: "postgres",
    query: async <T,>(text: string, params: unknown[] = []) => (await s.unsafe(text, params as never[])) as T[],
    exec: async (text: string) => { await s.unsafe(text); },
    tx: <R,>(fn: (d: Db) => Promise<R>) => (inTx ? fn(wrap(s, true)) : (sql.begin((t) => fn(wrap(t as unknown as Runner, true))) as Promise<R>)),
  });
  return wrap(sql as unknown as Runner, false);
}

/** PGlite: "memory" for tests, a directory for local development. Migrations run on open. */
export async function openPglite(where: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (where !== "memory") (await import("node:fs")).mkdirSync(where, { recursive: true });
  const pg = where === "memory" ? new PGlite() : new PGlite(where);
  await pg.waitReady;
  type Q = { query: typeof pg.query; exec: typeof pg.exec };
  const wrap = (x: Q, inTx: boolean): Db => ({
    kind: "pglite",
    query: async <T,>(text: string, params: unknown[] = []) => (await x.query<T>(text, params)).rows,
    exec: async (text: string) => { await x.exec(text); },
    tx: <R,>(fn: (d: Db) => Promise<R>) => (inTx ? fn(wrap(x, true)) : pg.transaction((t) => fn(wrap(t as unknown as Q, true)))),
  });
  const d = wrap(pg, false);
  await migrate(d);
  return d;
}

export async function migrate(d: Db): Promise<string[]> {
  await d.exec("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await d.query<{ id: string }>("select id from schema_migrations")).map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await d.tx(async (t) => {
      await t.exec(m.sql);
      await t.query("insert into schema_migrations (id) values ($1)", [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}
