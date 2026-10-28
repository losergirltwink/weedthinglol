import { describe, expect, it } from "vitest";

import { computeProfile, type ProfileSession, type ProfileStrain } from "./profile";

//        haze ─┬─▶ ssh (sativa)
//              └─▶ amnesia ─▶ amnesia-kid (sativa)
//        kush ───▶ og (indica)
const strains: Record<string, ProfileStrain> = {
  haze: { name: "Haze", strainType: "sativa", effects: ["uplifted"], parents: [] },
  kush: { name: "Kush", strainType: "indica", effects: ["sleepy"], parents: [] },
  ssh: { name: "Super Silver Haze", strainType: "sativa", effects: ["energetic", "happy"], parents: ["haze"] },
  amnesia: { name: "Amnesia", strainType: "sativa", effects: ["creative"], parents: ["haze"] },
  "amnesia-kid": { name: "Amnesia Kid", strainType: "sativa", effects: ["creative"], parents: ["amnesia"] },
  og: { name: "OG", strainType: "indica", effects: ["relaxed"], parents: ["kush"] },
};
const lookup = (k: string) => strains[k];

const session = (strainKey: string, ratingHalves: number, over: Partial<ProfileSession> = {}): ProfileSession => ({
  strainKey,
  ratingHalves,
  effectsFelt: [],
  negativesFelt: [],
  flavors: [],
  terpenes: [],
  method: null,
  wouldBuyAgain: null,
  ...over,
});

// Ratings (stars): ssh 5, amnesia-kid 4, og 1, og 2  → mean 3
const sessions = [
  session("ssh", 10, { effectsFelt: ["energetic", "happy"], flavors: ["citrus"], method: "vape", wouldBuyAgain: true }),
  session("amnesia-kid", 8, { negativesFelt: ["dry mouth"], method: "vape" }), // no tagged effects → falls back to listed
  session("og", 2, { effectsFelt: ["sleepy"], negativesFelt: ["dry mouth", "anxious"], flavors: ["citrus"], method: "flower", wouldBuyAgain: false }),
  session("og", 4, { effectsFelt: ["sleepy", "happy"], method: "flower" }),
  session("unknown-strain", 6),
];

describe("computeProfile", () => {
  const p = computeProfile(sessions, lookup);

  it("summarizes counts and centers on my mean", () => {
    // ratings 5, 4, 1, 2, 3 → mean 3
    expect(p).toMatchObject({ sessions: 5, strainsTried: 4, meanRating: 3, coldStart: false });
  });

  it("weights effects by rating relative to my mean (falling back to listed effects)", () => {
    // energetic: +2 (ssh) · happy: +2 (ssh) −1 (og 2★) = +1 · creative: +1 (amnesia-kid, listed)
    // sleepy: −2 (og 1★) −1 (og 2★) = −3
    expect(p.effects).toEqual([
      { tag: "sleepy", score: -3, sessions: 2 },
      { tag: "energetic", score: 2, sessions: 1 },
      { tag: "creative", score: 1, sessions: 1 },
      { tag: "happy", score: 1, sessions: 2 },
    ]);
  });

  it("counts side effects by frequency, not rating", () => {
    expect(p.sideEffects).toEqual([
      { tag: "dry mouth", sessions: 2, share: 0.4 },
      { tag: "anxious", sessions: 1, share: 0.2 },
    ]);
  });

  it("cancels out a flavor that shows up in good and bad sessions alike", () => {
    // citrus: +2 (ssh) −2 (og 1★) = 0 → dropped
    expect(p.flavors).toEqual([]);
  });

  it("propagates lineage affinity to ancestors with decay, requiring 2+ rated descendants", () => {
    // haze ← ssh (1 hop, +2 × 0.5 = 1) and amnesia-kid (2 hops, +1 × 0.25 = 0.25)
    // kush only has og (one strain, two sessions) → below the 2-descendant bar
    // amnesia only has amnesia-kid → below the bar
    expect(p.lineage).toEqual([{ key: "haze", name: "Haze", score: 1.25, via: ["Amnesia Kid", "Super Silver Haze"] }]);
  });

  it("groups by strain type and method", () => {
    expect(p.types).toEqual([
      { group: "sativa", avg: 4.5, sessions: 2 },
      { group: "indica", avg: 1.5, sessions: 2 },
    ]);
    expect(p.methods).toEqual([
      { group: "vape", avg: 4.5, sessions: 2 },
      { group: "flower", avg: 1.5, sessions: 2 },
    ]);
  });

  it("ranks strains without overlap between top and bottom", () => {
    expect(p.topStrains.map((s) => [s.key, s.avg])).toEqual([
      ["ssh", 5],
      ["amnesia-kid", 4],
      ["unknown-strain", 3],
      ["og", 1.5],
    ]);
    expect(p.bottomStrains.map((s) => s.key)).toEqual(["og", "unknown-strain"]);
    expect(p.topStrains.find((s) => s.key === "unknown-strain")?.name).toBe("unknown-strain");
  });

  it("tallies would-buy-again", () => {
    expect(p.wouldBuyAgain).toEqual({ yes: 1, no: 1 });
  });
});

describe("computeProfile edge cases", () => {
  it("is empty and cold with no sessions", () => {
    const p = computeProfile([], lookup);
    expect(p).toMatchObject({ sessions: 0, meanRating: null, coldStart: true, effects: [], lineage: [], topStrains: [] });
  });

  it("flags cold start below 5 sessions", () => {
    expect(computeProfile(sessions.slice(0, 4), lookup).coldStart).toBe(true);
  });

  it("learns nothing from identical ratings (no contrast)", () => {
    const p = computeProfile([session("ssh", 6, { effectsFelt: ["happy"] }), session("og", 6, { effectsFelt: ["sleepy"] })], lookup);
    expect(p.effects).toEqual([]);
  });

  it("survives a parent cycle in the lookup", () => {
    const cyclic = (k: string): ProfileStrain | undefined =>
      ({ a: { name: "A", strainType: "hybrid" as const, effects: [], parents: ["b"] }, b: { name: "B", strainType: "hybrid" as const, effects: [], parents: ["a"] } })[k];
    expect(() => computeProfile([session("a", 8), session("b", 2)], cyclic)).not.toThrow();
  });
});
