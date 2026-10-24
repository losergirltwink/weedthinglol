import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DbHandle } from "@/db/client";
import { freshDb } from "@/test/db";
import { parseEntry } from "../journal/input";
import { addToWishlist, createEntry } from "../journal/queries";
import { parsePersonalStrain, type PersonalStrainInput } from "./input";
import {
  createPersonalStrain,
  deletePersonalStrain,
  getPersonalStrain,
  listPersonalStrains,
  personalChildrenOf,
  personalStrainUsage,
  updatePersonalStrain,
  wouldCreateCycle,
} from "./queries";

describe("parsePersonalStrain", () => {
  it("accepts a minimal strain and de-dupes parents", () => {
    const r = parsePersonalStrain({ name: " Local Gas ", strainType: "hybrid", parentKeys: ["a", "a", "b"] });
    expect(r.ok && r.data).toEqual({ name: "Local Gas", strainType: "hybrid", parentKeys: ["a", "b"], notes: null });
  });

  it.each([
    ["empty name", { name: "  " }, "name"],
    ["punctuation-only name", { name: "???" }, "name"],
    ["unknown type", { strainType: "ruderalis" }, "strainType"],
    ["too many parents", { parentKeys: ["a", "b", "c", "d", "e"] }, "parentKeys"],
    ["huge notes", { notes: "x".repeat(2001) }, "notes"],
  ])("rejects %s", (_n, over, field) => {
    const r = parsePersonalStrain({ name: "Ok", strainType: "hybrid", ...over });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain(field);
  });
});

describe("personal strain queries", () => {
  let h: DbHandle;
  beforeEach(async () => {
    h = await freshDb();
  });
  afterEach(async () => h.close());

  const input = (over: Partial<PersonalStrainInput> = {}): PersonalStrainInput => ({
    name: "Local Gas",
    strainType: "hybrid",
    parentKeys: [],
    notes: null,
    ...over,
  });

  it("creates, reads, updates, lists and deletes", async () => {
    await createPersonalStrain(h.db, "local-gas", input({ parentKeys: ["og-kush"] }));
    expect(await getPersonalStrain(h.db, "local-gas")).toMatchObject({ name: "Local Gas", parentKeys: ["og-kush"] });
    await updatePersonalStrain(h.db, "local-gas", input({ name: "LOCAL GAS", notes: "dispensary x" }));
    expect(await getPersonalStrain(h.db, "local-gas")).toMatchObject({ name: "LOCAL GAS", notes: "dispensary x" });
    expect((await listPersonalStrains(h.db)).map((p) => p.strainKey)).toEqual(["local-gas"]);
    expect(await deletePersonalStrain(h.db, "local-gas")).toBe(true);
    expect(await deletePersonalStrain(h.db, "local-gas")).toBe(false);
  });

  it("finds personal children of any strain", async () => {
    await createPersonalStrain(h.db, "kid-1", input({ name: "Kid 1", parentKeys: ["og-kush", "haze"] }));
    await createPersonalStrain(h.db, "kid-2", input({ name: "Kid 2", parentKeys: ["haze"] }));
    expect((await personalChildrenOf(h.db, "haze")).map((p) => p.strainKey)).toEqual(["kid-1", "kid-2"]);
    expect(await personalChildrenOf(h.db, "nothing")).toEqual([]);
  });

  it("reports usage so in-use strains aren't deleted", async () => {
    await createPersonalStrain(h.db, "mine", input({ name: "Mine" }));
    await createPersonalStrain(h.db, "kid", input({ name: "Kid", parentKeys: ["mine"] }));
    const r = parseEntry({ strainKey: "mine", ratingHalves: 6, consumedOn: "2026-10-01" });
    if (!r.ok) throw new Error("bad fixture");
    await createEntry(h.db, r.data);
    await addToWishlist(h.db, "mine");
    expect(await personalStrainUsage(h.db, "mine")).toEqual({ entries: 1, wishlisted: true, children: ["kid"] });
    expect(await personalStrainUsage(h.db, "kid")).toEqual({ entries: 0, wishlisted: false, children: [] });
  });

  it("detects cycles through personal parents", async () => {
    // a ← b ← c   (c's parent is b, b's parent is a)
    await createPersonalStrain(h.db, "a", input({ name: "A" }));
    await createPersonalStrain(h.db, "b", input({ name: "B", parentKeys: ["a"] }));
    await createPersonalStrain(h.db, "c", input({ name: "C", parentKeys: ["b", "og-kush"] }));
    expect(await wouldCreateCycle(h.db, "a", ["c"])).toBe(true); // a → … → c → a
    expect(await wouldCreateCycle(h.db, "a", ["a"])).toBe(true);
    expect(await wouldCreateCycle(h.db, "a", ["og-kush"])).toBe(false);
    expect(await wouldCreateCycle(h.db, "new", ["c"])).toBe(false);
  });
});
