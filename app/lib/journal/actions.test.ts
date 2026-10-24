// Structural guard: server actions are public endpoints, so every exported
// action must check ownership before doing anything else. Cheap insurance
// against a future action that forgets.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, it } from "vitest";

it("every exported server action starts with `await requireOwner()`", () => {
  const src = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
  expect(src.startsWith('"use server";')).toBe(true);
  // Signature (possibly multi-line) up to the brace that ends it, then the
  // first statement of the body.
  const actions = [...src.matchAll(/export async function (\w+)\([\s\S]*?\)\s*:[^\n]*\{\n\s*([^\n]*)/g)];
  const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  expect(actions.map((a) => a[1])).toEqual(exported);
  for (const [, name, firstLine] of actions) {
    expect(firstLine.trim(), `${name} must begin with requireOwner()`).toBe("await requireOwner();");
  }
  // No other kind of export may sneak in (non-function exports aren't allowed in
  // "use server" files anyway, but const arrow exports would skip this check).
  expect(src).not.toMatch(/export (const|let|var|default)/);
});
