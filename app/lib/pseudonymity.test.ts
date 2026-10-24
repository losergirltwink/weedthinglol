// Pseudonymity audit (docs/phase-5-plan.md 5E): the owner's GitHub identity
// (name, email, avatar on the auth `user` row) must never reach a rendered page,
// an API payload, or the browser. Enforced structurally: app code may only ever
// use the user's opaque id.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const sourceFiles = ["app", "db", "scripts", "proxy.ts"].flatMap((dir) => {
  const full = join(root, dir);
  if (dir.endsWith(".ts")) return [full];
  return (readdirSync(full, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(full, f));
});

const RULES: [string, RegExp][] = [
  ["reads a GitHub identity field", /\buser\??\.(name|email|image)\b/],
  ["imports the auth `user` table", /import\s*\{[^}]*\buser\b[^}]*\}\s*from\s*["']@\/db\/schema["']/],
  ["uses a client session hook (would ship the profile to the browser)", /authClient\.(useSession|getSession)\b/],
];

describe("pseudonymity", () => {
  it("scans the codebase", () => {
    expect(sourceFiles.length).toBeGreaterThan(20);
  });

  for (const [what, pattern] of RULES) {
    it(`no source file ${what}`, () => {
      const offenders = sourceFiles.filter((f) => pattern.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
      expect(offenders).toEqual([]);
    });
  }
});
