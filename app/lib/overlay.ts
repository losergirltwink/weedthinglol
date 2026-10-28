// Builds the personal overlay (see overlay-types.ts). Visibility is decided by
// `includePrivate` (= viewer.isOwner): visitors get ratings + profile from
// PUBLIC sessions only. Personal-strain notes are never included.

import "server-only";

import type { Db } from "@/db/client";
import { hasStrain } from "./catalog";
import { listEntries, listWishlist } from "./journal/queries";
import type { Overlay } from "./overlay-types";
import { listPersonalStrains } from "./personal/queries";
import { computeProfile } from "./profile";
import { profileLookup } from "./strain-resolver";

export async function buildOverlay(db: Db, { includePrivate }: { includePrivate: boolean }): Promise<Overlay> {
  const [entries, wishlist, personal, lookup] = await Promise.all([
    listEntries(db, { includePrivate, limit: 100_000 }),
    listWishlist(db),
    listPersonalStrains(db),
    profileLookup(db),
  ]);

  const sums = new Map<string, { total: number; n: number }>();
  for (const e of entries) {
    const cur = sums.get(e.strainKey) ?? { total: 0, n: 0 };
    cur.total += e.ratingHalves;
    cur.n++;
    sums.set(e.strainKey, cur);
  }

  const p = computeProfile(entries, lookup);
  return {
    isOwner: includePrivate,
    ratings: Object.fromEntries([...sums].map(([k, { total, n }]) => [k, { avgHalves: total / n, sessions: n }])),
    wishlist: wishlist.map((w) => w.strainKey),
    personal: personal
      .filter((x) => !hasStrain(x.strainKey))
      .map((x) => ({ key: x.strainKey, name: x.name, strainType: x.strainType, parents: x.parentKeys })),
    profile: {
      coldStart: p.coldStart,
      meanRating: p.meanRating,
      effects: p.effects,
      lineage: p.lineage,
      types: p.types,
      sideEffects: p.sideEffects,
    },
  };
}
