// Structural guard: server actions are public endpoints, so every exported
// action in every `actions.ts` must check ownership before doing anything else.
// Cheap insurance against a future action that forgets.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const actionFiles = (readdirSync(root, { recursive: true }) as string[])
  .filter((f) => /(^|\/)actions\.ts$/.test(f))
  .map((f) => join(root, f));

describe("server actions", () => {
  it("are discovered", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(2);
  });

  for (const file of actionFiles) {
    it(`${relative(root, file)}: every export starts with \`await requireOwner()\``, () => {
      const src = readFileSync(file, "utf8");
      expect(src.startsWith('"use server";')).toBe(true);
      // Signature (possibly multi-line) up to the brace that ends it, then the
      // first statement of the body.
      const actions = [...src.matchAll(/export async function (\w+)\([\s\S]*?\)\s*:[^\n]*\{\n\s*([^\n]*)/g)];
      const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
      expect(actions.map((a) => a[1])).toEqual(exported);
      for (const [, name, firstLine] of actions) {
        expect(firstLine.trim(), `${name} must begin with requireOwner()`).toBe("await requireOwner();");
      }
      // Const/arrow exports would dodge the check above.
      expect(src).not.toMatch(/export (const|let|var|default)/);
    });
  }
});
