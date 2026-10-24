import { afterEach, beforeEach, expect, it } from "vitest";

import type { DbHandle } from "@/db/client";
import { freshDb } from "@/test/db";
import { parseEntry } from "./journal/input";
import { addToWishlist, createEntry } from "./journal/queries";
import { buildOverlay } from "./overlay";
import { createPersonalStrain } from "./personal/queries";

let h: DbHandle;
beforeEach(async () => {
  h = await freshDb();
});
afterEach(async () => h.close());

async function log(strainKey: string, ratingHalves: number, isPublic = true) {
  const r = parseEntry({ strainKey, ratingHalves, consumedOn: "2026-10-01", isPublic });
  if (!r.ok) throw new Error("fixture");
  await createEntry(h.db, r.data);
}

it("aggregates ratings per strain and hides private sessions from visitors", async () => {
  await log("blue-dream", 8);
  await log("blue-dream", 6);
  await log("og-kush", 2, false);
  await addToWishlist(h.db, "jack-herer");
  await createPersonalStrain(h.db, "local-gas", { name: "Local Gas", strainType: "indica", parentKeys: ["og-kush"], notes: "SECRET" });
  await createPersonalStrain(h.db, "blue-dream", { name: "Blue Dream", strainType: "hybrid", parentKeys: [], notes: null }); // shadowed

  const visitor = await buildOverlay(h.db, { includePrivate: false });
  expect(visitor.isOwner).toBe(false);
  expect(visitor.ratings).toEqual({ "blue-dream": { avgHalves: 7, sessions: 2 } });
  expect(visitor.wishlist).toEqual(["jack-herer"]);
  expect(visitor.personal).toEqual([{ key: "local-gas", name: "Local Gas", strainType: "indica", parents: ["og-kush"] }]);
  expect(JSON.stringify(visitor)).not.toContain("SECRET");

  const owner = await buildOverlay(h.db, { includePrivate: true });
  expect(owner.ratings["og-kush"]).toEqual({ avgHalves: 2, sessions: 1 });
  expect(owner.profile.meanRating).toBeCloseTo((4 + 3 + 1) / 3);
});
