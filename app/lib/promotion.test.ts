import { describe, expect, it } from "vitest";

import { rankCandidates, shadowedPersonal } from "./promotion";
import type { CatalogEntry } from "./strains";

const entry = (key: string, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  key,
  name: key.toUpperCase(),
  strainType: "hybrid",
  effects: [],
  negatives: [],
  nameKind: "named",
  source: "kushy",
  confidence: "crowd",
  generation: 0,
  descendants: 0,
  parents: [],
  children: [],
  ...over,
});

const catalog = [
  entry("core-a", { confidence: "curated", source: "curated" }),
  entry("core-b", { confidence: "curated", source: "curated" }),
  entry("bridge", { parents: ["core-a", "core-b"] }), // 2 curated relatives
  entry("lonely"), // no signal at all
  entry("tried-one", { parents: ["lonely"] }),
  entry("a-x-b", { nameKind: "cross", parents: ["core-a", "core-b"] }),
];

describe("rankCandidates", () => {
  it("ranks personal use above structure and explains why", () => {
    const ranked = rankCandidates({
      catalog,
      personal: [{ strainKey: "my-find", name: "My Find", parentKeys: ["core-a", "mystery"] }],
      tried: new Map([["tried-one", 2]]),
      wishlist: new Set(["bridge"]),
    });
    expect(ranked.map((c) => [c.key, c.score])).toEqual([
      ["tried-one", 20],
      ["bridge", 9],
      ["my-find", 3],
    ]);
    expect(ranked[0]).toMatchObject({ reasons: ["tried 2×"], uncuratedParents: ["lonely"], origin: "crowd" });
    expect(ranked[1].reasons).toEqual(["on want-to-try list", "2 curated relatives"]);
    expect(ranked[2]).toMatchObject({ origin: "personal", uncuratedParents: ["mystery"] });
  });

  it("skips curated, signal-less, and impersonal cross nodes", () => {
    const keys = rankCandidates({ catalog, personal: [], tried: new Map(), wishlist: new Set() }).map((c) => c.key);
    expect(keys).toEqual(["bridge"]);
  });

  it("queues a cross node once it matters personally", () => {
    const keys = rankCandidates({ catalog, personal: [], tried: new Map([["a-x-b", 1]]), wishlist: new Set() }).map(
      (c) => c.key,
    );
    expect(keys).toContain("a-x-b");
  });

  it("leaves promoted personal strains to shadowedPersonal", () => {
    const personal = [
      { strainKey: "bridge", name: "Bridge", parentKeys: [] },
      { strainKey: "new-one", name: "New One", parentKeys: [] },
    ];
    const ranked = rankCandidates({ catalog, personal, tried: new Map(), wishlist: new Set() });
    expect(ranked.filter((c) => c.origin === "personal").map((c) => c.key)).toEqual(["new-one"]);
    expect(shadowedPersonal(catalog, personal).map((p) => p.strainKey)).toEqual(["bridge"]);
  });

  it("respects the limit", () => {
    expect(rankCandidates({ catalog, personal: [], tried: new Map(), wishlist: new Set(), limit: 0 })).toEqual([]);
  });
});
