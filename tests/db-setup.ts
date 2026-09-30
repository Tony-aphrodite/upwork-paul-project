import { randomBytes } from "node:crypto";
import { memoryDb, migrate, openPostgres, useDb, type Db } from "../src/lib/db";

/**
 * Each test file gets a fresh, empty database. By default that is an in-memory PGlite. With TEST_DATABASE_URL set
 * (a Postgres server the tests may create databases on, e.g. postgres://postgres@127.0.0.1:5544/postgres), a new
 * database is created for the file and the production driver (postgres.js) is used, so the same tests check the real
 * code path. Only point it at a local, disposable server.
 */
export async function freshTestDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const d = memoryDb();
    useDb(d);
    return d;
  }
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local server");
  // With a real database the app insists on a proper AUTH_SECRET; tests get a throwaway one.
  process.env.AUTH_SECRET ||= randomBytes(32).toString("hex");
  const admin = await openPostgres(url);
  const name = `an_test_${randomBytes(5).toString("hex")}`;
  await admin.exec(`create database ${name}`);
  await admin.close();
  const target = new URL(url);
  target.pathname = `/${name}`;
  process.env.DATABASE_URL = target.toString();
  const d = openPostgres(target.toString()).then(async (x) => { await migrate(x); return x; });
  useDb(d);
  return d;
}
