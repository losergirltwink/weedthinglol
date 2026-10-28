import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const prodEnv = {
  DATABASE_URL: "postgres://u:p@host/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "https://example.com",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
  OWNER_GITHUB_ID: "123",
};

describe("parseEnv", () => {
  it("needs nothing in development (local PGlite, localhost)", () => {
    const r = parseEnv({}, false);
    expect(r.success && r.data).toMatchObject({
      DATABASE_URL: "pglite://.data/pglite",
      BETTER_AUTH_URL: "http://localhost:3000",
    });
  });

  it("accepts a complete production env", () => {
    expect(parseEnv(prodEnv, true).success).toBe(true);
  });

  it("lists every missing production variable at once", () => {
    const r = parseEnv({}, true);
    expect(r.success).toBe(false);
    if (!r.success) {
      for (const key of ["BETTER_AUTH_SECRET", "OWNER_GITHUB_ID", "GITHUB_CLIENT_ID", "DATABASE_URL"]) {
        expect(r.error).toContain(key);
      }
    }
  });

  it.each([
    ["PGlite in production", { DATABASE_URL: "pglite://.data/pglite" }, /local-only/],
    ["a short secret", { BETTER_AUTH_SECRET: "short" }, /32 characters/],
    ["a non-numeric owner id", { OWNER_GITHUB_ID: "octocat" }, /numeric/],
    ["a non-postgres URL", { DATABASE_URL: "mysql://x" }, /postgres/],
    ["half a GitHub app", { GITHUB_CLIENT_SECRET: "" }, /set together/],
  ])("rejects %s", (_name, override, pattern) => {
    const r = parseEnv({ ...prodEnv, ...override }, true);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(pattern);
  });

  it("falls back to VERCEL_URL on preview deployments", () => {
    const r = parseEnv({ ...prodEnv, BETTER_AUTH_URL: undefined, VERCEL_URL: "x-git-y.vercel.app" }, true);
    expect(r.success && r.data.BETTER_AUTH_URL).toBe("https://x-git-y.vercel.app");
  });

  it("treats empty strings as unset", () => {
    const r = parseEnv({ BETTER_AUTH_URL: "" }, false);
    expect(r.success && r.data.BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});
