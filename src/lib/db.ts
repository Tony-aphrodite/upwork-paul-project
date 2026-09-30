import { MIGRATIONS } from "./migrations";

/**
 * The one way the app reaches the database. Production and staging use Postgres through DATABASE_URL (Supabase in
 * Sydney, through its transaction pooler, so prepared statements are off). Without DATABASE_URL, and never on
 * Vercel, a local PGlite database (Postgres compiled to WebAssembly) is used, so development and tests run the same
 * SQL with nothing to install. The same test suites also run against a real Postgres with TEST_DATABASE_URL.
 *
 * Parameters are positional ($1, $2 …) and limited to plain values. JSON goes in only through `jsonb(value)`, which
 * each driver serialises exactly once; a JSON string passed as a plain parameter would be stored as a jsonb string by
 * postgres.js. `undefined` is refused, because the two drivers treat it differently.
 */

export class JsonParam { constructor(readonly value: unknown) {} }
export const jsonb = (value: unknown) => new JsonParam(value);
export type Param = string | number | boolean | null | JsonParam;

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: Param[]): Promise<T[]>;
  /** Several statements, no parameters: migrations only. */
  exec(text: string): Promise<void>;
  /** Run `fn` in one transaction; inside a transaction it simply runs `fn`. */
  tx<R>(fn: (db: Db) => Promise<R>): Promise<R>;
  close(): Promise<void>;
  readonly kind: "postgres" | "pglite";
}

const g = globalThis as unknown as { __anDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__anDb) g.__anDb = open().catch((e) => { g.__anDb = undefined; throw e; });
  return g.__anDb;
}

/** Tests give each suite its own database. */
export function useDb(next: Promise<Db> | undefined) { g.__anDb = next; }

function checkParams(params: Param[]) {
  params.forEach((p, i) => { if (p === undefined) throw new Error(`Database parameter $${i + 1} is undefined`); });
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const d = url ? await openPostgres(url) : process.env.VERCEL ? null : await openPglite(process.env.PGLITE_DIR ?? ".data/pglite");
  if (!d) throw new Error("DATABASE_URL is not set");
  await migrate(d);
  return d;
}

/** Errors that mean the connection died, not the statement. Only reads are retried, so nothing is written twice. */
const CONNECTION_LOST = new Set(["ECONNRESET", "EPIPE", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED"]);

export async function openPostgres(url: string): Promise<Db> {
  const postgres = (await import("postgres")).default;
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  // Supabase's CA certificate (DATABASE_CA_CERT, PEM) turns on full certificate checks; without it the connection is
  // still encrypted but the server's certificate is not verified.
  const ca = process.env.DATABASE_CA_CERT;
  const ssl = local || /sslmode=/.test(url) ? {} : { ssl: ca ? { ca, rejectUnauthorized: true } : ("require" as const) };
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, onnotice: () => undefined, ...ssl });
  type Runner = { unsafe: (text: string, params?: never[]) => PromiseLike<unknown>; json: (v: never) => unknown };
  const toDriver = (params: Param[]) => params.map((p) => (p instanceof JsonParam ? sql.json(p.value as never) : p)) as never[];
  const wrap = (s: Runner, inTx: boolean): Db => ({
    kind: "postgres",
    query: async <T,>(text: string, params: Param[] = []) => {
      checkParams(params);
      try {
        return (await s.unsafe(text, toDriver(params))) as T[];
      } catch (e) {
        if (inTx || !CONNECTION_LOST.has((e as { code?: string }).code ?? "") || !/^\s*select\b/i.test(text)) throw e;
        return (await s.unsafe(text, toDriver(params))) as T[];
      }
    },
    exec: async (text: string) => { await s.unsafe(text); },
    tx: <R,>(fn: (d: Db) => Promise<R>) => (inTx ? fn(wrap(s, true)) : (sql.begin((t) => fn(wrap(t as unknown as Runner, true))) as Promise<R>)),
    close: () => sql.end({ timeout: 5 }),
  });
  return wrap(sql as unknown as Runner, false);
}

/** PGlite: "memory" for tests, a directory for local development. */
export async function openPglite(where: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (where !== "memory") (await import("node:fs")).mkdirSync(where, { recursive: true });
  const pg = where === "memory" ? new PGlite() : new PGlite(where);
  await pg.waitReady;
  type Q = { query: typeof pg.query; exec: typeof pg.exec };
  const toDriver = (params: Param[]) => params.map((p) => (p instanceof JsonParam ? JSON.stringify(p.value) : p));
  const wrap = (x: Q, inTx: boolean): Db => ({
    kind: "pglite",
    query: async <T,>(text: string, params: Param[] = []) => { checkParams(params); return (await x.query<T>(text, toDriver(params))).rows; },
    exec: async (text: string) => { await x.exec(text); },
    tx: <R,>(fn: (d: Db) => Promise<R>) => (inTx ? fn(wrap(x, true)) : pg.transaction((t) => fn(wrap(t as unknown as Q, true)))),
    close: () => pg.close(),
  });
  return wrap(pg, false);
}

/** In-memory PGlite with the schema applied, for tests. */
export async function memoryDb(): Promise<Db> {
  const d = await openPglite("memory");
  await migrate(d);
  return d;
}

/**
 * Apply pending migrations, in order, each recorded in schema_migrations. Runs whenever the app opens the database,
 * so a deploy can never run ahead of its schema; an advisory lock keeps two cold starts from migrating at once.
 */
export async function migrate(d: Db): Promise<string[]> {
  return d.tx(async (t) => {
    await t.query("select pg_advisory_xact_lock(771001)");
    await t.exec("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await t.query<{ id: string }>("select id from schema_migrations")).map((r) => r.id));
    const applied: string[] = [];
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await t.exec(m.sql);
      await t.query("insert into schema_migrations (id) values ($1)", [m.id]);
      applied.push(m.id);
    }
    return applied;
  });
}
