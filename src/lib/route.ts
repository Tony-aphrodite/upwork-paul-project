import { NextResponse } from "next/server";
import { Conflict, getCase, type CaseRecord } from "./cases";
import { navigatorOr401 } from "./session";
import { bad } from "./api";
import { log } from "./log";
import type { Navigator } from "./navigators";
import { caseForToken } from "./family-link";
import type { LinkedCase } from "./cases";

/**
 * The shape every API route shares, in one place:
 * - admin routes check the navigator (and the Origin), and case routes load the case or answer 404;
 * - family routes resolve the private link or answer 404;
 * - a stale edit answers 409; anything unexpected is logged by its code only (a database error can quote a row,
 *   which may hold personal data) and answers a plain 500.
 */

type Params<P> = { params: Promise<P> };

function failure(e: unknown) {
  if (e instanceof Conflict) return bad(e.message, undefined, 409);
  const err = e as { code?: string; name?: string };
  log("route.error", { code: String(err.code ?? err.name ?? "error").slice(0, 40) });
  return bad("Something went wrong. Please try again.", undefined, 500);
}

export function publicRoute<P = Record<string, never>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Params<P>) => {
    try { return await fn(req, await ctx.params); } catch (e) { return failure(e); }
  };
}

export function adminRoute<P = Record<string, never>>(fn: (req: Request, nav: Navigator, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Params<P>) => {
    try {
      const nav = await navigatorOr401(req);
      if (nav instanceof NextResponse) return nav;
      return await fn(req, nav, await ctx.params);
    } catch (e) { return failure(e); }
  };
}

export function caseRoute(fn: (req: Request, nav: Navigator, c: CaseRecord) => Promise<Response>) {
  return adminRoute<{ id: string }>(async (req, nav, { id }) => {
    const c = await getCase(id);
    return c ? fn(req, nav, c) : bad("Case not found.", undefined, 404);
  });
}

export function familyRoute(fn: (req: Request, c: LinkedCase, token: string) => Promise<Response>) {
  return publicRoute<{ token: string }>(async (req, { token }) => {
    const c = await caseForToken(token);
    return c ? fn(req, c, token) : bad("This link is not valid any more. If you need your plan again, please contact us.", undefined, 404);
  });
}
