import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DbHandle } from "@/db/client";
import { freshDb } from "@/test/db";
import { parseEntry, type EntryInput } from "./input";
import {
  addToWishlist,
  createEntry,
  deleteEntry,
  getEntry,
  isWishlisted,
  listEntries,
  listWishlist,
  removeFromWishlist,
  strainSummary,
  triedKeys,
  updateEntry,
} from "./queries";

let h: DbHandle;
beforeEach(async () => {
  h = await freshDb();
});
afterEach(async () => h.close());

function entry(over: Record<string, unknown> = {}): EntryInput {
  const r = parseEntry({ strainKey: "blue-dream", ratingHalves: 8, consumedOn: "2026-10-01", ...over });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

describe("entries", () => {
  it("round-trips every field", async () => {
    const created = await createEntry(
      h.db,
      entry({
        notes: "Bright and clear.",
        effectsFelt: ["uplifted"],
        negativesFelt: ["dry mouth"],
        flavors: ["berry"],
        terpenes: ["myrcene"],
        method: "vape",
        timeOfDay: "afternoon",
        dose: "2 puffs",
        brand: "Acme",
        batch: "B-12",
        wouldBuyAgain: true,
      }),
    );
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    const got = await getEntry(h.db, created.id, { includePrivate: true });
    expect(got).toMatchObject({
      strainKey: "blue-dream",
      ratingHalves: 8,
      consumedOn: "2026-10-01",
      effectsFelt: ["uplifted"],
      negativesFelt: ["dry mouth"],
      method: "vape",
      timeOfDay: "afternoon",
      wouldBuyAgain: true,
      isPublic: true,
    });
  });

  it("hides private entries from public reads", async () => {
    const pub = await createEntry(h.db, entry());
    const priv = await createEntry(h.db, entry({ isPublic: false }));
    expect((await listEntries(h.db, { includePrivate: false })).map((e) => e.id)).toEqual([pub.id]);
    expect(await listEntries(h.db, { includePrivate: true })).toHaveLength(2);
    expect(await getEntry(h.db, priv.id, { includePrivate: false })).toBeUndefined();
  });

  it("lists newest first and filters by strain", async () => {
    await createEntry(h.db, entry({ consumedOn: "2026-01-01" }));
    await createEntry(h.db, entry({ consumedOn: "2026-03-01" }));
    await createEntry(h.db, entry({ strainKey: "og-kush", consumedOn: "2026-02-01" }));
    const all = await listEntries(h.db, { includePrivate: true });
    expect(all.map((e) => e.consumedOn)).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
    expect(await listEntries(h.db, { includePrivate: true, strainKey: "og-kush" })).toHaveLength(1);
  });

  it("updates and deletes", async () => {
    const e = await createEntry(h.db, entry());
    const updated = await updateEntry(h.db, e.id, entry({ ratingHalves: 3, isPublic: false }));
    expect(updated).toMatchObject({ ratingHalves: 3, isPublic: false });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(e.updatedAt.getTime());
    expect(await deleteEntry(h.db, e.id)).toBeDefined();
    expect(await getEntry(h.db, e.id, { includePrivate: true })).toBeUndefined();
    expect(await updateEntry(h.db, e.id, entry())).toBeUndefined();
  });

  it("enforces the rating range in the database too", async () => {
    await expect(createEntry(h.db, { ...entry(), ratingHalves: 11 })).rejects.toThrow();
  });
});

describe("strainSummary", () => {
  it("aggregates visible sessions only", async () => {
    await createEntry(h.db, entry({ ratingHalves: 8, effectsFelt: ["happy", "creative"] }));
    await createEntry(h.db, entry({ ratingHalves: 6, effectsFelt: ["happy"] }));
    await createEntry(h.db, entry({ ratingHalves: 2, isPublic: false, effectsFelt: ["sleepy"] }));

    const pub = await strainSummary(h.db, "blue-dream", { includePrivate: false });
    expect(pub).toEqual({
      sessions: 2,
      avgHalves: 7,
      topEffects: [
        { effect: "happy", count: 2 },
        { effect: "creative", count: 1 },
      ],
    });
    expect((await strainSummary(h.db, "blue-dream", { includePrivate: true })).sessions).toBe(3);
  });

  it("is empty for an untried strain", async () => {
    expect(await strainSummary(h.db, "nope", { includePrivate: true })).toEqual({
      sessions: 0,
      avgHalves: null,
      topEffects: [],
    });
  });
});

describe("wishlist", () => {
  it("adds idempotently, lists, and removes", async () => {
    await addToWishlist(h.db, "og-kush", { source: "graph", note: "friend rec" });
    await addToWishlist(h.db, "og-kush"); // no-op, keeps the original
    expect(await isWishlisted(h.db, "og-kush")).toBe(true);
    expect(await listWishlist(h.db)).toMatchObject([{ strainKey: "og-kush", source: "graph", note: "friend rec" }]);
    await removeFromWishlist(h.db, "og-kush");
    expect(await isWishlisted(h.db, "og-kush")).toBe(false);
  });
});

it("triedKeys reports strains with visible sessions", async () => {
  await createEntry(h.db, entry({ strainKey: "a" }));
  await createEntry(h.db, entry({ strainKey: "b", isPublic: false }));
  expect(await triedKeys(h.db, ["a", "b", "c"], { includePrivate: false })).toEqual(new Set(["a"]));
  expect(await triedKeys(h.db, ["a", "b", "c"], { includePrivate: true })).toEqual(new Set(["a", "b"]));
  expect(await triedKeys(h.db, [], { includePrivate: true })).toEqual(new Set());
});
