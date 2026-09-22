import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as generate } from "../src/app/api/plans/generate/route";
import { POST as validate } from "../src/app/api/plans/validate/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { GET as schema } from "../src/app/api/schemas/[name]/route";
import { middleware } from "../src/middleware";
import { SESSION_COOKIE, createSession } from "../src/lib/auth";
import { log } from "../src/lib/log";
import { planOf, profileOf } from "./helpers";

const post = (body: unknown, headers: Record<string, string> = {}) => new Request("http://x/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } });

describe("API", () => {
  it("generates a plan from a valid profile", async () => {
    const res = await generate(post({ profile: profileOf("healthy-couple") }));
    expect(res.status).toBe(200);
    const { plan } = await res.json();
    expect(plan.version).toBe("1.0");
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });
  it("returns field paths for an invalid profile", async () => {
    const res = await generate(post({ profile: { ...profileOf("healthy-couple"), mobility: { level: "flying" } } }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details.map((d: { path: string }) => d.path)).toContain("profile.mobility.level");
  });
  it("refuses a previous plan that belongs to someone else", async () => {
    const res = await generate(post({ profile: profileOf("healthy-couple"), previous: planOf("alone-with-falls") }));
    expect(res.status).toBe(422);
  });
  it("rejects bodies that are not JSON or too large", async () => {
    expect((await generate(post("not json"))).status).toBe(400);
    expect((await generate(post("x".repeat(600_000)))).status).toBe(400);
  });
  it("validates plans from other systems, including dangling action keys", async () => {
    const plan = planOf("alone-with-falls");
    expect(await (await validate(post(plan))).json()).toMatchObject({ ok: true });
    const broken = { ...plan, modules: [{ ...plan.modules[0], actionKeys: ["x:missing"] }, ...plan.modules.slice(1)] };
    expect((await (await validate(post(broken))).json()).ok).toBe(false);
    expect((await (await validate(post({ ...plan, actions: [{ ...plan.actions[0], priority: "someday" }] }))).json()).ok).toBe(false);
  });
  it("serves JSON Schemas", async () => {
    const res = await schema(new Request("http://x"), { params: Promise.resolve({ name: "family-profile" }) });
    const json = await res.json();
    expect(json.properties.person).toBeTruthy();
  });
});

describe("security", () => {
  const req = (path: string, cookie?: string) => new NextRequest(`http://x${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });
  it("blocks admin pages and APIs without a session", async () => {
    expect((await middleware(req("/admin"))).status).toBe(307);
    expect((await middleware(req("/api/plans/generate"))).status).toBe(401);
    expect((await middleware(req("/api/documents", "forged.token.value"))).status).toBe(401);
  });
  it("lets a signed session through, and leaves sign-in and schemas public", async () => {
    const token = await createSession();
    expect((await middleware(req("/admin", token))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(req("/api/auth/login"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(req("/api/schemas/action-plan"))).headers.get("x-middleware-next")).toBe("1");
  });
  it("signs in with the right password only, and rate limits guessing", async () => {
    expect((await login(post({ password: "wrong" }, { "x-forwarded-for": "10.1.1.1" }))).status).toBe(401);
    const ok = await login(post({ password: "navigator-demo" }, { "x-forwarded-for": "10.1.1.2" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly.*SameSite=strict|SameSite=strict.*HttpOnly/i);
    const codes = [];
    for (let i = 0; i < 9; i++) codes.push((await login(post({ password: "nope" }, { "x-forwarded-for": "10.1.1.3" }))).status);
    expect(codes.at(-1)).toBe(429);
  });
  it("never logs personal fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const out = log("test", { planId: "AP-1", name: "Joan Whitaker", notes: "private", profile: { a: 1 } });
    expect(out).toEqual({ event: "test", at: expect.any(String), planId: "AP-1" });
    expect(spy.mock.calls[0][0]).not.toMatch(/Joan|private/);
    spy.mockRestore();
  });
});
