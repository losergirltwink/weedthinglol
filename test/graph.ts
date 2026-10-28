// Test helper: a tiny hand-built strain graph with just the attributes the
// client-side logic reads.
import { DirectedGraph } from "graphology";

import type { StrainGraphType } from "@/app/lib/graph-utils";
import type { Confidence, StrainNodeAttributes, StrainType } from "@/app/lib/strains";

export interface NodeSpec {
  type?: StrainType;
  effects?: string[];
  negatives?: string[];
  gen?: number;
  cross?: boolean;
  x?: number;
  y?: number;
  confidence?: Confidence;
}

export function graphOf(nodes: Record<string, NodeSpec>, edges: [string, string][] = []): StrainGraphType {
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
      x: n.x ?? 0,
      y: n.y ?? 0,
      size: 1,
      color: "#000",
      source: "curated",
      confidence: n.confidence ?? "curated",
    });
  }
  for (const [p, c] of edges) g.addDirectedEdgeWithKey(`${p}->${c}`, p, c);
  return g;
}
