// Pure graph operations for the personal overlay (shared by 2D + 3D via the
// explorer hook). No layout runs in the browser: personal strains are placed
// at their parents' centroid plus a small deterministic offset.

import type { StrainGraphType } from "./graph-utils";
import type { Overlay } from "./overlay-types";
import { TYPE_COLORS } from "./strains";

/** strainKey → node id for every node in the graph. */
export function keyIndex(graph: StrainGraphType): Map<string, string> {
  const m = new Map<string, string>();
  graph.forEachNode((id, a) => m.set(a.strainKey, id));
  return m;
}

/** Stable pseudo-random in [0, 1) from a string (FNV-1a). */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 2 ** 32;
}

export const personalNodeId = (key: string) => `personal:${key}`;

/**
 * Insert personal strains into `graph` (mutates). A strain is placed once at
 * least one parent is in the graph (catalog node or an already-placed personal
 * strain), so personal→personal chains resolve over passes. Parentless/orphaned
 * strains go in a column left of the graph — only when `includeUnplaced` (the
 * `all` view), since they'd be noise in a single-source graph. Returns the ids
 * inserted. Keys already in the graph are skipped (the catalog wins).
 */
export function insertPersonalStrains(
  graph: StrainGraphType,
  personal: Overlay["personal"],
  { includeUnplaced }: { includeUnplaced: boolean },
): string[] {
  const ids = keyIndex(graph);
  const pending = personal.filter((p) => !ids.has(p.key));
  const inserted: string[] = [];

  const add = (p: Overlay["personal"][number], x: number, y: number, parentIds: string[]) => {
    const id = personalNodeId(p.key);
    const gen = parentIds.length
      ? 1 + Math.max(...parentIds.map((pid) => graph.getNodeAttribute(pid, "generation")))
      : 0;
    graph.addNode(id, {
      label: p.name,
      strainKey: p.key,
      strainType: p.strainType,
      effects: [],
      negatives: [],
      nameKind: "named",
      generation: gen,
      descendants: 0,
      x,
      y,
      size: 4,
      color: TYPE_COLORS[p.strainType],
      source: "personal",
      confidence: "personal",
    });
    for (const pid of parentIds) graph.addDirectedEdgeWithKey(`${pid}->${id}`, pid, id, { size: 1.5, color: "#374151", type: "arrow" });
    ids.set(p.key, id);
    inserted.push(id);
  };

  // Resolve in passes so a personal child can follow its personal parent.
  let progress = true;
  while (progress && pending.length) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const parentIds = p.parents.map((k) => ids.get(k)).filter((x): x is string => !!x);
      if (!parentIds.length) continue;
      const cx = parentIds.reduce((s, id) => s + graph.getNodeAttribute(id, "x"), 0) / parentIds.length;
      const cy = parentIds.reduce((s, id) => s + graph.getNodeAttribute(id, "y"), 0) / parentIds.length;
      const angle = hash01(p.key) * 2 * Math.PI;
      const r = 4 + hash01(`${p.key}#r`) * 4;
      add(p, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, parentIds);
      pending.splice(i--, 1);
      progress = true;
    }
  }

  if (includeUnplaced && pending.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    graph.forEachNode((_id, a) => {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxY = Math.max(maxY, a.y);
    });
    if (!Number.isFinite(minX)) [minX, minY, maxY] = [0, 0, 0];
    const step = pending.length > 1 ? (maxY - minY) / (pending.length - 1) : 0;
    pending.forEach((p, i) => add(p, minX - 20, minY + step * i, []));
  }

  return inserted;
}

/**
 * Nodes + edges on the shortest undirected paths between every pair of
 * `nodeIds` — the "how my favorites connect" highlight. BFS per source; pairs
 * with no connecting path contribute nothing.
 */
export function connectingPaths(graph: StrainGraphType, nodeIds: string[]): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  const targets = nodeIds.filter((id) => graph.hasNode(id));
  for (let i = 0; i < targets.length; i++) {
    const from = targets[i];
    const prev = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const n = queue.shift()!;
      graph.forEachNeighbor(n, (m) => {
        if (!prev.has(m)) {
          prev.set(m, n);
          queue.push(m);
        }
      });
    }
    for (const to of targets.slice(i + 1)) {
      if (!prev.has(to)) continue;
      for (let cur: string = to; prev.get(cur) != null; cur = prev.get(cur)!) {
        const p = prev.get(cur)!;
        nodes.add(cur).add(p);
        edges.add(graph.edge(p, cur) ?? graph.edge(cur, p)!);
      }
      nodes.add(from);
    }
  }
  return { nodes, edges };
}
