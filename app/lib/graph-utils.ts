import type { DirectedGraph } from "graphology";
import type { StrainNodeAttributes } from "./strains";

export type StrainGraphType = DirectedGraph<StrainNodeAttributes>;

/**
 * The "family line" of a strain: itself, all of its ancestors (walking
 * parent edges up) and all of its descendants (walking child edges down).
 * Siblings and cousins are intentionally excluded — this is the vertical
 * lineage used for focus+context highlighting.
 */
export function computeFamily(graph: StrainGraphType, id: string): Set<string> {
  const family = new Set<string>([id]);

  const up = [id];
  while (up.length) {
    const node = up.pop()!;
    graph.forEachInNeighbor(node, (parent) => {
      if (!family.has(parent)) {
        family.add(parent);
        up.push(parent);
      }
    });
  }

  const down = [id];
  while (down.length) {
    const node = down.pop()!;
    graph.forEachOutNeighbor(node, (child) => {
      if (!family.has(child)) {
        family.add(child);
        down.push(child);
      }
    });
  }

  return family;
}
