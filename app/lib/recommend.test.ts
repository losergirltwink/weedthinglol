import { DirectedGraph } from "graphology";
import { describe, expect, it } from "vitest";

import type { StrainGraphType } from "./graph-utils";
import { allEffects, negativeEffects, recommend } from "./recommend";
import type { StrainNodeAttributes, StrainType } from "./strains";

interface NodeSpec {
  type?: StrainType;
  effects?: string[];
  negatives?: string[];
  gen?: number;
  cross?: boolean;
}

/** Tiny hand-built graph with just the attributes the recommender reads. */
function graphOf(nodes: Record<string, NodeSpec>, edges: [string, string][] = []): StrainGraphType {
  const g: StrainGraphType = new DirectedGraph<StrainNodeAttributes>();
  for (const [id, n] of Object.entries(nodes)) {
    g.addNode(id, {
      label: id.toUpperCase(),
      strainKey: id,
      strainType: n.type ?? "hybrid",
      effects: n.effects ?? [],
      negatives: n.negatives ?? [],
      nameKind: n.cross ? "cross" : "named",
      generation: n.gen ?? 0,
      descendants: 0,
      x: 0,
      y: 0,
      size: 1,
      color: "#000",
      source: "curated",
      confidence: "curated",
    });
  }
  for (const [p, c] of edges) g.addDirectedEdge(p, c);
  return g;
}

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
