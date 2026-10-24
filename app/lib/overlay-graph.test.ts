import { describe, expect, it } from "vitest";

import { graphOf } from "@/test/graph";
import { connectingPaths, insertPersonalStrains, keyIndex, personalNodeId } from "./overlay-graph";

describe("insertPersonalStrains", () => {
  const base = () =>
    graphOf({ a: { x: 0, y: 0, gen: 1 }, b: { x: 10, y: 10, gen: 3 } }, [["a", "b"]]);

  it("places a strain near its parents' centroid, deterministically", () => {
    const g = base();
    const ids = insertPersonalStrains(g, [{ key: "mine", name: "Mine", strainType: "indica", parents: ["a", "b"] }], {
      includeUnplaced: false,
    });
    expect(ids).toEqual([personalNodeId("mine")]);
    const n = g.getNodeAttributes(personalNodeId("mine"));
    const dist = Math.hypot(n.x - 5, n.y - 5);
    expect(dist).toBeGreaterThanOrEqual(4);
    expect(dist).toBeLessThanOrEqual(8);
    expect(n).toMatchObject({ confidence: "personal", strainKey: "mine", generation: 4, label: "Mine" });
    expect(g.hasEdge(`a->${personalNodeId("mine")}`)).toBe(true);
    const again = base();
    insertPersonalStrains(again, [{ key: "mine", name: "Mine", strainType: "indica", parents: ["a", "b"] }], {
      includeUnplaced: false,
    });
    expect(again.getNodeAttribute(personalNodeId("mine"), "x")).toBe(n.x);
  });

  it("resolves personal → personal chains regardless of order", () => {
    const g = base();
    insertPersonalStrains(
      g,
      [
        { key: "grandkid", name: "GK", strainType: "hybrid", parents: ["kid"] },
        { key: "kid", name: "K", strainType: "hybrid", parents: ["a"] },
      ],
      { includeUnplaced: false },
    );
    expect(g.hasEdge(`${personalNodeId("kid")}->${personalNodeId("grandkid")}`)).toBe(true);
  });

  it("only places orphans when asked, in a column left of the graph", () => {
    const orphan = [{ key: "lost", name: "Lost", strainType: "hybrid" as const, parents: ["nope"] }];
    const g = base();
    expect(insertPersonalStrains(g, orphan, { includeUnplaced: false })).toEqual([]);
    const g2 = base();
    insertPersonalStrains(g2, orphan, { includeUnplaced: true });
    expect(g2.getNodeAttribute(personalNodeId("lost"), "x")).toBeLessThan(0);
  });

  it("skips keys the graph already has (catalog wins)", () => {
    const g = base();
    expect(insertPersonalStrains(g, [{ key: "a", name: "A", strainType: "hybrid", parents: [] }], { includeUnplaced: true })).toEqual([]);
    expect(keyIndex(g).get("a")).toBe("a");
  });
});

describe("connectingPaths", () => {
  //  a ─▶ b ─▶ c      d (isolated)
  //       └──▶ e
  const g = graphOf({ a: {}, b: {}, c: {}, d: {}, e: {} }, [
    ["a", "b"],
    ["b", "c"],
    ["b", "e"],
  ]);

  it("collects nodes and edges on shortest paths between favorites (undirected)", () => {
    const { nodes, edges } = connectingPaths(g, ["c", "e"]);
    expect([...nodes].sort()).toEqual(["b", "c", "e"]);
    expect([...edges].sort()).toEqual(["b->c", "b->e"]);
  });

  it("ignores unreachable or unknown nodes", () => {
    const { nodes, edges } = connectingPaths(g, ["a", "d", "ghost"]);
    expect(nodes.size).toBe(0);
    expect(edges.size).toBe(0);
  });
});
