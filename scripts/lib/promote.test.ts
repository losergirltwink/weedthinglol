import { describe, expect, it } from "vitest";

import type { Strain } from "@/app/lib/strains";
import { planPromotion, type PromotionSource } from "./promote";

const curated: Strain[] = [
  { id: "skunk-1", name: "Skunk #1", type: "hybrid" },
  { id: "haze", name: "Haze", type: "sativa" },
];
const src = (over: Partial<PromotionSource> = {}): PromotionSource => ({
  key: "super-silver-haze",
  name: "Super Silver Haze",
  strainType: "sativa",
  effects: ["energetic"],
  parents: ["skunk-no1", "haze", "northern-lights"],
  origin: "crowd",
  ...over,
});

describe("planPromotion", () => {
  it("builds a reported, uncited record and edges to curated parents (mapped by key → id)", () => {
    const plan = planPromotion(src(), curated);
    expect(plan).toEqual({
      ok: true,
      record: {
        id: "super-silver-haze",
        name: "Super Silver Haze",
        type: "sativa",
        effects: ["energetic"],
        lineageStatus: "reported",
      },
      edges: [
        { parent: "skunk-1", child: "super-silver-haze" },
        { parent: "haze", child: "super-silver-haze" },
      ],
      missingParents: ["northern-lights"],
    });
  });

  it("omits empty effects", () => {
    const plan = planPromotion(src({ effects: [] }), curated);
    expect(plan.ok && plan.record).not.toHaveProperty("effects");
  });

  it("refuses a strain that is already curated (matched by strainKey, not id)", () => {
    const plan = planPromotion(src({ key: "skunk-no1", name: "Skunk No. 1" }), curated);
    expect(plan).toEqual({ ok: false, error: expect.stringMatching(/already curated \(id "skunk-1"\)/) });
  });

  it("refuses an id collision with a differently-named curated record", () => {
    const plan = planPromotion(src({ key: "haze", name: "Haze!" }), [{ id: "haze", name: "Original Haze", type: "sativa" }]);
    expect(plan.ok).toBe(false);
  });
});
