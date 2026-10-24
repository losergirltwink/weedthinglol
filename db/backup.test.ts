// Doubles as the restore drill: export from one database, import into a fresh
// one, and require the personal data to come back identical.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseEntry } from "@/app/lib/journal/input";
import { addToWishlist, createEntry, listEntries, listWishlist } from "@/app/lib/journal/queries";
import { createPersonalStrain, listPersonalStrains } from "@/app/lib/personal/queries";
import { freshDb } from "@/test/db";
import { exportJournal, importJournal } from "./backup";
import type { DbHandle } from "./client";

let src: DbHandle;
let dst: DbHandle;
beforeEach(async () => {
  [src, dst] = await Promise.all([freshDb(), freshDb()]);
  const r = parseEntry({
    strainKey: "local-gas",
    ratingHalves: 7,
    consumedOn: "2026-10-01",
    notes: "line one\nline two",
    effectsFelt: ["happy"],
    method: "vape",
    isPublic: false,
  });
  if (!r.ok) throw new Error("fixture");
  await createPersonalStrain(src.db, "local-gas", { name: "Local Gas", strainType: "indica", parentKeys: ["og-kush"], notes: "n" });
  await createEntry(src.db, r.data);
  await addToWishlist(src.db, "sour-diesel", { source: "rec", note: "try it" });
});
afterEach(async () => {
  await Promise.all([src.close(), dst.close()]);
});

describe("journal backup", () => {
  it("round-trips through JSON into a fresh database unchanged", async () => {
    const json = JSON.parse(JSON.stringify(await exportJournal(src.db)));
    expect(await importJournal(dst.db, json)).toEqual({ journalEntries: 1, wishlistItems: 1, personalStrains: 1 });
    expect(await listEntries(dst.db, { includePrivate: true })).toEqual(await listEntries(src.db, { includePrivate: true }));
    expect(await listWishlist(dst.db)).toEqual(await listWishlist(src.db));
    expect(await listPersonalStrains(dst.db)).toEqual(await listPersonalStrains(src.db));
  });

  it("refuses to merge into existing data unless replacing", async () => {
    const data = await exportJournal(src.db);
    await expect(importJournal(src.db, data)).rejects.toThrow(/--replace/);
    await expect(importJournal(src.db, data, { replace: true })).resolves.toMatchObject({ journalEntries: 1 });
    expect(await listEntries(src.db, { includePrivate: true })).toHaveLength(1);
  });

  it("validates before writing anything", async () => {
    const bad = { ...(await exportJournal(src.db)), version: 2 };
    await expect(importJournal(dst.db, bad)).rejects.toThrow();
    expect(await listWishlist(dst.db)).toEqual([]);
  });
});
