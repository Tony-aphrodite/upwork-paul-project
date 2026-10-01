import { db } from "./db";

/**
 * Fixed-window limits kept in the database, so they hold across serverless instances. Keys never contain an address
 * or an email in clear: callers pass `pseudonym(...)`.
 * - `hit` counts one attempt and says whether it is still within the limit;
 * - `blocked` only looks, for limits that count failures (sign-in), so a correct password is not what uses them up.
 */
const WINDOW_OPEN = "window_start >= now() - make_interval(secs => $2)";

export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [r] = await (await db()).query<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count`, [key, windowSeconds]);
  return Number(r.count) <= limit;
}

export async function blocked(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [r] = await (await db()).query<{ count: number }>(`select count from rate_limits where key = $1 and ${WINDOW_OPEN}`, [key, windowSeconds]);
  return !!r && Number(r.count) >= limit;
}

export async function clear(key: string) {
  await (await db()).query("delete from rate_limits where key = $1", [key]);
}
