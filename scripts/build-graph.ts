/**
 * build-graph.ts — compiles the curated source data into public/graph.json.
 *
 * Pipeline:
 *   1. Load data/strains.json + data/lineage.json
 *   2. Validate (duplicate ids, dangling refs, self-loops, cycles)
 *   3. Compute derived fields: generation depth + descendant count
 *   4. Bake presentation attributes (label, color, size)
 *   5. Run ForceAtlas2 layout offline (deterministic seed)
 *   6. Export a Graphology-serialized graph the client imports as-is
 *
 * Run with: pnpm build:graph
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { DirectedGraph } from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import type { Strain, Lineage } from "../app/lib/strains";
import { TYPE_COLORS } from "../app/lib/strains";

const ROOT = process.cwd();
const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(resolve(ROOT, rel), "utf8")) as T;

const strains = read<Strain[]>("data/strains.json");
const lineage = read<Lineage[]>("data/lineage.json");

// ---------------------------------------------------------------------------
// 1 + 2. Build graph and validate
// ---------------------------------------------------------------------------
const errors: string[] = [];
const graph = new DirectedGraph();

const seen = new Set<string>();
for (const s of strains) {
  if (seen.has(s.id)) {
    errors.push(`Duplicate strain id: "${s.id}"`);
    continue;
  }
  seen.add(s.id);
  graph.addNode(s.id, {
    label: s.name,
    // NB: stored as `strainType`, not `type` — Sigma reserves the node
    // `type` attribute for selecting the rendering program.
    strainType: s.type,
    effects: s.effects ?? [],
    ...(s.note ? { note: s.note } : {}),
  });
}

for (const { parent, child } of lineage) {
  if (!graph.hasNode(parent)) {
    errors.push(`Lineage references unknown parent: "${parent}" -> "${child}"`);
    continue;
  }
  if (!graph.hasNode(child)) {
    errors.push(`Lineage references unknown child: "${parent}" -> "${child}"`);
    continue;
  }
  if (parent === child) {
    errors.push(`Self-loop in lineage: "${parent}"`);
    continue;
  }
  const key = `${parent}->${child}`;
  if (graph.hasEdge(key)) {
    errors.push(`Duplicate lineage edge: ${key}`);
    continue;
  }
  graph.addEdgeWithKey(key, parent, child);
}

// Cycle detection (a genetic ancestry graph must be acyclic).
{
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const mark = new Map<string, number>();
  graph.forEachNode((n) => mark.set(n, WHITE));
  const stackPath: string[] = [];

  const visit = (node: string): void => {
    mark.set(node, GRAY);
    stackPath.push(node);
    for (const next of graph.outNeighbors(node)) {
      const m = mark.get(next);
      if (m === GRAY) {
        const cut = stackPath.indexOf(next);
        errors.push(`Cycle detected: ${[...stackPath.slice(cut), next].join(" -> ")}`);
      } else if (m === WHITE) {
        visit(next);
      }
    }
    stackPath.pop();
    mark.set(node, BLACK);
  };

  graph.forEachNode((n) => {
    if (mark.get(n) === WHITE) visit(n);
  });
}

if (errors.length) {
  console.error(`\n✗ Validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Derived fields: generation depth (longest path from a root) + descendants
// ---------------------------------------------------------------------------
const genMemo = new Map<string, number>();
const generation = (node: string): number => {
  const cached = genMemo.get(node);
  if (cached !== undefined) return cached;
  let g = 0;
  for (const parent of graph.inNeighbors(node)) {
    g = Math.max(g, generation(parent) + 1);
  }
  genMemo.set(node, g);
  return g;
};

const descendants = (node: string): number => {
  const seenD = new Set<string>();
  const stack = [...graph.outNeighbors(node)];
  while (stack.length) {
    const c = stack.pop()!;
    if (seenD.has(c)) continue;
    seenD.add(c);
    for (const n of graph.outNeighbors(c)) stack.push(n);
  }
  return seenD.size;
};

// ---------------------------------------------------------------------------
// 4. Bake presentation attributes
// ---------------------------------------------------------------------------
graph.forEachNode((node, attrs) => {
  const gen = generation(node);
  const desc = descendants(node);
  graph.mergeNodeAttributes(node, {
    generation: gen,
    descendants: desc,
    // Influence-scaled size: roots of big families render larger.
    size: 4 + Math.sqrt(desc) * 3,
    color: TYPE_COLORS[attrs.strainType as keyof typeof TYPE_COLORS] ?? "#9ca3af",
  });
});

graph.forEachEdge((edge) => {
  graph.mergeEdgeAttributes(edge, { size: 1.5, color: "#374151", type: "arrow" });
});

// ---------------------------------------------------------------------------
// 5. Layout — seed deterministically, then run ForceAtlas2
// ---------------------------------------------------------------------------
// Deterministic PRNG so re-running produces identical coordinates.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(42);

// Seed positions with a generation-based horizontal gradient so ancestry
// roughly flows left -> right before the force layout refines it.
graph.forEachNode((node) => {
  const gen = generation(node);
  graph.mergeNodeAttributes(node, {
    x: gen * 10 + (rand() - 0.5) * 4,
    y: (rand() - 0.5) * 60,
  });
});

const settings = forceAtlas2.inferSettings(graph);
forceAtlas2.assign(graph, {
  iterations: 600,
  settings: {
    ...settings,
    barnesHutOptimize: true,
    gravity: 1,
    scalingRatio: 12,
    adjustSizes: true,
    slowDown: 5,
  },
});

// ---------------------------------------------------------------------------
// 6. Export
// ---------------------------------------------------------------------------
const out = resolve(ROOT, "public/graph.json");
mkdirSync(resolve(ROOT, "public"), { recursive: true });
writeFileSync(out, JSON.stringify(graph.export(), null, 2));

const maxGen = Math.max(...[...genMemo.values()]);
console.log(
  `✓ Built graph.json — ${graph.order} strains, ${graph.size} lineage edges, max depth ${maxGen}.`,
);
