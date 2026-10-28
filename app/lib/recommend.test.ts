import { describe, expect, it } from "vitest";

import { graphOf } from "@/test/graph";
import type { Overlay } from "./overlay-types";
import { allEffects, negativeEffects, recommend, recommendForProfile } from "./recommend";

const ids = (recs: { id: string }[]) => recs.map((r) => r.id);

describe("recommend — effects-only mode", () => {
  const g = graphOf({
    exact: { effects: ["happy", "creative"] },
    half: { effects: ["happy", "sleepy"] },
    none: { effects: ["sleepy"] },
  });

  it("ranks by Jaccard overlap and drops zero-score candidates", () => {
    const recs = recommend(g, { effects: ["happy", "creative"] });
    expect(ids(recs)).toEqual(["exact", "half"]);
    expect(recs[0].effectScore).toBe(1);
    expect(recs[1].effectScore).toBeCloseTo(1 / 3);
    expect(recs[1].sharedEffects).toEqual(["happy"]);
  });

  it("ignores lineage and has no seed-only explanations", () => {
    const [top] = recommend(g, { effects: ["happy"] });
    expect(top.lineageScore).toBe(0);
    expect(top.distance).toBeNull();
    expect(top.commonAncestor).toBeNull();
    expect(top.driver).toBe("effect");
  });

  it("respects the limit", () => {
    expect(recommend(g, { effects: ["happy"], limit: 1 })).toHaveLength(1);
  });
});

describe("recommend — seed mode", () => {
  //   gp
  //   |
  //   p ──▶ seed
  //   └───▶ sib
  // far (unrelated, same effect overlap as sib, different type)
  const g = graphOf(
    {
      gp: { gen: 0, effects: ["relaxed"] },
      p: { gen: 1, effects: ["relaxed"] },
      seed: { gen: 2, effects: ["happy", "uplifted"], type: "sativa" },
      sib: { gen: 2, effects: ["happy"], type: "sativa" },
      far: { gen: 0, effects: ["happy"], type: "indica" },
    },
    [
      ["gp", "p"],
      ["p", "seed"],
      ["p", "sib"],
    ],
  );

  it("never recommends the seed itself", () => {
    expect(ids(recommend(g, { seedId: "seed", limit: 10 }))).not.toContain("seed");
  });

  it("at equal effect overlap, lineage + type rank a relative above a stranger", () => {
    const recs = recommend(g, { seedId: "seed", limit: 10 });
    const sib = recs.find((r) => r.id === "sib")!;
    expect(sib.distance).toBe(2);
    expect(sib.driver).toBe("both");
    expect(sib.commonAncestor).toEqual({ id: "p", label: "P" });
    const far = recs.find((r) => r.id === "far")!;
    expect(far.effectScore).toBe(sib.effectScore);
    expect(far.driver).toBe("effect");
    expect(ids(recs)[0]).toBe("sib");
  });

  it("explains lineage-only matches", () => {
    const gp = recommend(g, { seedId: "seed", limit: 10 }).find((r) => r.id === "gp")!;
    expect(gp.driver).toBe("lineage");
    expect(gp.effectScore).toBe(0);
  });

  it("falls back to effects-only when the seed id is unknown", () => {
    const recs = recommend(g, { seedId: "nope", effects: ["happy"] });
    expect(recs.every((r) => r.lineageScore === 0)).toBe(true);
  });
});

describe("recommend — penalties", () => {
  it("penalizes explicitly-avoided side-effects (case-insensitively)", () => {
    const g = graphOf({
      clean: { effects: ["happy"] },
      anxious: { effects: ["happy"], negatives: ["anxious"] },
    });
    const recs = recommend(g, { effects: ["happy"], avoid: ["Anxious"] });
    expect(ids(recs)).toEqual(["clean", "anxious"]);
    expect(recs[1].score).toBeCloseTo(recs[0].score * 0.45);
  });

  it("only charges side-effects the seed doesn't already have", () => {
    const g = graphOf({
      seed: { effects: ["happy"], negatives: ["dry mouth"] },
      same: { effects: ["happy"], negatives: ["dry mouth"] },
      worse: { effects: ["happy"], negatives: ["dry mouth", "paranoid"] },
    });
    const recs = recommend(g, { seedId: "seed" });
    const same = recs.find((r) => r.id === "same")!;
    const worse = recs.find((r) => r.id === "worse")!;
    expect(worse.score).toBeCloseTo(same.score / 1.2);
  });

  it("down-weights cross-expression targets", () => {
    const g = graphOf({
      named: { effects: ["happy"] },
      cross: { effects: ["happy"], cross: true },
    });
    const recs = recommend(g, { effects: ["happy"] });
    expect(ids(recs)).toEqual(["named", "cross"]);
    expect(recs[1].score).toBeCloseTo(recs[0].score * 0.6);
  });
});

describe("effect vocabularies", () => {
  const g = graphOf({
    a: { effects: ["uplifted", "happy"], negatives: ["dry mouth"] },
    b: { effects: ["happy"], negatives: ["anxious"] },
  });

  it("lists distinct desirable effects, sorted", () => {
    expect(allEffects(g)).toEqual(["happy", "uplifted"]);
  });

  it("lists distinct side-effects, sorted", () => {
    expect(negativeEffects(g)).toEqual(["anxious", "dry mouth"]);
  });
});

describe("recommendForProfile", () => {
  //  haze ──▶ amnesia (tried, loved)
  //    └────▶ ssh (untried)          kush ──▶ og (tried, disliked)
  //  lemon (untried, unrelated, effects I like)   sleepy-k (untried, kush child)
  const g = graphOf(
    {
      haze: { type: "sativa", effects: ["uplifted"] },
      amnesia: { type: "sativa", effects: ["creative"] },
      ssh: { type: "sativa", effects: ["energetic"] },
      kush: { type: "indica", effects: ["sleepy"] },
      og: { type: "indica", effects: ["sleepy"] },
      "sleepy-k": { type: "indica", effects: ["sleepy"], negatives: ["dry mouth"] },
      lemon: { type: "hybrid", effects: ["creative", "energetic"] },
      "lemon-x": { type: "hybrid", effects: ["creative", "energetic"], cross: true },
      nothing: { type: "hybrid", effects: ["hungry"] },
    },
    [
      ["haze", "amnesia"],
      ["haze", "ssh"],
      ["kush", "og"],
      ["kush", "sleepy-k"],
    ],
  );
  const profile: Overlay["profile"] = {
    coldStart: false,
    meanRating: 3,
    effects: [
      { tag: "creative", score: 2, sessions: 2 },
      { tag: "energetic", score: 1, sessions: 1 },
      { tag: "sleepy", score: -2, sessions: 2 },
    ],
    lineage: [
      { key: "haze", name: "Haze", score: 1.5, via: ["Amnesia", "SSH-like"] },
      { key: "kush", name: "Kush", score: -1, via: ["OG", "X"] },
    ],
    types: [
      { group: "sativa", avg: 4.5, sessions: 2 },
      { group: "indica", avg: 1.5, sessions: 2 },
    ],
    sideEffects: [{ tag: "dry mouth", sessions: 2, share: 0.5 }],
  };
  const recs = recommendForProfile(g, profile, { tried: new Set(["amnesia", "og"]), limit: 10 });
  const byId = Object.fromEntries(recs.map((r) => [r.id, r]));

  it("never recommends tried strains or strains with no effect/lineage signal", () => {
    expect(byId.amnesia).toBeUndefined();
    expect(byId.og).toBeUndefined();
    expect(byId.nothing).toBeUndefined();
    expect(byId["sleepy-k"]).toBeUndefined(); // only disliked effects + disliked lineage
  });

  it("scores effects against my positive affinity", () => {
    expect(byId.lemon.effectScore).toBe(1); // creative 2 + energetic 1 = all of my positive 3
    expect(byId.lemon.likedEffects).toEqual(["creative", "energetic"]);
  });

  it("credits lineage through liked ancestors, incl. the ancestor itself", () => {
    expect(byId.ssh.lineageScore).toBeCloseTo(0.5); // child of haze: 1 × 0.5
    expect(byId.ssh.reasons).toContain("descends from Haze");
    expect(byId.haze.lineageScore).toBe(1);
    expect(byId.haze.reasons.some((r) => r.startsWith("ancestor of strains you rate highly"))).toBe(true);
  });

  it("nudges by strain type and explains it", () => {
    expect(byId.ssh.reasons).toContain("you tend to like sativas");
  });

  it("down-weights cross-expression nodes", () => {
    expect(byId["lemon-x"].score).toBeCloseTo(byId.lemon.score * 0.6);
  });

  it("penalizes side effects I report often", () => {
    const g2 = graphOf({ a: { effects: ["creative"] }, b: { effects: ["creative"], negatives: ["dry mouth"] } });
    const [a, b] = recommendForProfile(g2, profile, { tried: new Set() });
    expect([a.id, b.id]).toEqual(["a", "b"]);
    expect(b.flaggedNegatives).toEqual(["dry mouth"]);
    expect(b.score).toBeCloseTo(a.score * 0.45);
  });

  it("ignores rarely-reported side effects", () => {
    const rare = { ...profile, sideEffects: [{ tag: "dry mouth", sessions: 1, share: 0.5 }] };
    const g2 = graphOf({ b: { effects: ["creative"], negatives: ["dry mouth"] } });
    expect(recommendForProfile(g2, rare, { tried: new Set() })[0].flaggedNegatives).toEqual([]);
  });
});
