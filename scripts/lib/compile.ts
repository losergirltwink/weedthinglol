// Pure compile core for the graph build (scripts/build-graph.ts is the thin
// driver that loads sources and writes files). Split out so the validation,
// derived fields, and union merge are unit-testable against small fixtures.

import { DirectedGraph } from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

import type { Catalog, CatalogEntry, Strain, Lineage, Confidence } from "../../app/lib/strains";
import { TYPE_COLORS, LINEAGE_STATUSES, isNegativeEffect } from "../../app/lib/strains";
import { strainKey } from "../../app/lib/strain-key";
import type { SourceDef } from "../../data/sources";
import type { SourceData } from "../adapters/types";
import { CROSS_SPLIT } from "../adapters/kushy";

/** Where a baked node came from — its origin source id and trust tier. */
export interface Provenance {
  source: string;
  confidence: Confidence;
}

/**
 * Entity-kind classification (approach 2: "require resolved parents"). A node is
 * a `cross` expression only when its NAME is a cross formula ("A x B") AND every
 * component already produced a parent edge — i.e. it's genuine connective tissue
 * between parents we have, not a named cultivar that merely contains an "x".
 *
 * "Resolved" is counted STRUCTURALLY (in-degree ≥ component count), not by
 * re-matching component text against parent labels: the adapter already resolved
 * aliases/abbreviations when it built the edges ("GSC" → Girl Scout Cookies,
 * "G13" → G-13), so re-matching here with a weaker matcher would wrongly miss
 * those. Cross-shaped names still short a parent stay `named` (reported as
 * "stragglers"). Curated names are never cross-shaped.
 */
export function classifyNameKind(
  name: string,
  inDegree: number,
): { kind: "named" | "cross"; shaped: boolean } {
  const parts = name.split(CROSS_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { kind: "named", shaped: false };
  return { kind: inDegree >= parts.length ? "cross" : "named", shaped: true };
}

/**
 * Compile canonical records into a serialized, laid-out graph. Provenance is
 * resolved per node (`provenanceFor`) so the union can carry each node's true
 * origin rather than a uniform tag. Pure aside from logging — returns the export
 * plus any validation errors so the caller decides whether to fail the build.
 */
export function compile(
  strains: Strain[],
  lineage: Lineage[],
  provenanceFor: (id: string) => Provenance,
): { graph: DirectedGraph; errors: string[]; maxGen: number } {
  const errors: string[] = [];
  const graph = new DirectedGraph();

  // -------------------------------------------------------------------------
  // 1 + 2. Build graph and validate
  // -------------------------------------------------------------------------
  const seen = new Set<string>();
  const idByKey = new Map<string, string>();
  for (const s of strains) {
    if (seen.has(s.id)) {
      errors.push(`Duplicate strain id: "${s.id}"`);
      continue;
    }
    seen.add(s.id);
    // One strainKey per graph: it's the identity persisted data points at, so two
    // nodes sharing one would make a review ambiguous.
    const key = strainKey(s.name);
    const clash = idByKey.get(key);
    if (!key) errors.push(`Strain "${s.id}" has a name that yields an empty strainKey`);
    else if (clash) errors.push(`Duplicate strainKey "${key}": "${clash}" and "${s.id}"`);
    else idByKey.set(key, s.id);
    if (s.lineageStatus && !LINEAGE_STATUSES.includes(s.lineageStatus)) {
      errors.push(`Strain "${s.id}" has unknown lineageStatus "${s.lineageStatus}"`);
    }
    for (const c of s.citations ?? []) {
      // Rendered as links on a public site — only http(s), never javascript: etc.
      if (!c.label?.trim() || !/^https?:\/\//i.test(c.url ?? "")) {
        errors.push(`Strain "${s.id}" has an invalid citation (needs a label and http(s) url)`);
      }
    }
    // Partition effects into desirable vs side-effects to avoid. Crowd sources
    // mix the two in one list; splitting here (source-agnostic) keeps the
    // recommender's effect-similarity clean and feeds the avoid-penalty.
    const effects: string[] = [];
    const negatives: string[] = [];
    for (const e of s.effects ?? []) (isNegativeEffect(e) ? negatives : effects).push(e);
    graph.addNode(s.id, {
      label: s.name,
      strainKey: key,
      // NB: stored as `strainType`, not `type` — Sigma reserves the node
      // `type` attribute for selecting the rendering program.
      strainType: s.type,
      effects,
      negatives,
      ...(s.note ? { note: s.note } : {}),
      ...(s.citations?.length ? { citations: s.citations } : {}),
      ...(s.lineageStatus ? { lineageStatus: s.lineageStatus } : {}),
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

  // Validation failures are returned, not thrown, so the caller can report all
  // sources before exiting.
  if (errors.length) return { graph, errors, maxGen: 0 };

  // -------------------------------------------------------------------------
  // 3. Derived fields: generation depth (longest path from a root) + descendants
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 4. Bake presentation attributes + provenance
  // -------------------------------------------------------------------------
  let crossShaped = 0;
  let crossTagged = 0;
  let curatedUncited = 0;
  graph.forEachNode((node, attrs) => {
    const gen = generation(node);
    const desc = descendants(node);
    const prov = provenanceFor(node);
    const nameKind = classifyNameKind(attrs.label as string, graph.inDegree(node));
    if (nameKind.shaped) {
      crossShaped++;
      if (nameKind.kind === "cross") crossTagged++;
    }
    if (prov.confidence === "curated" && !attrs.citations) curatedUncited++;
    graph.mergeNodeAttributes(node, {
      generation: gen,
      descendants: desc,
      // Influence-scaled size: roots of big families render larger.
      size: 4 + Math.sqrt(desc) * 3,
      color: TYPE_COLORS[attrs.strainType as keyof typeof TYPE_COLORS] ?? "#9ca3af",
      // Entity-kind: named cultivar vs cross-expression (see classifyNameKind).
      nameKind: nameKind.kind,
      // Provenance: which source contributed this node, and its trust tier.
      source: prov.source,
      confidence: prov.confidence,
    });
  });
  if (crossShaped > 0) {
    console.log(
      `  ↳ entity-kind: ${crossTagged}/${crossShaped} cross-shaped name(s) tagged \`cross\` ` +
        `(${crossShaped - crossTagged} straggler(s): cross-shaped but not all parents resolved).`,
    );
  }

  // Citations are a soft requirement for curated records while they're backfilled
  // (docs/phase-5-plan.md 5A.2); this becomes a hard error once that's done.
  if (curatedUncited > 0) {
    console.warn(`  ⚠ citations: ${curatedUncited} curated strain(s) have no citation yet.`);
  }

  graph.forEachEdge((edge) => {
    graph.mergeEdgeAttributes(edge, { size: 1.5, color: "#374151", type: "arrow" });
  });

  // -------------------------------------------------------------------------
  // 5. Layout — seed deterministically, then run ForceAtlas2
  // -------------------------------------------------------------------------
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

  const maxGen = genMemo.size ? Math.max(...genMemo.values()) : 0;
  return { graph, errors, maxGen };
}

/**
 * Merge all sources into one canonical dataset with curated-wins precedence.
 * SOURCES is ordered by trust, so the FIRST writer of an identity wins. Identity
 * is matched by NAME (strainKey), not id — sources use disjoint id namespaces
 * (curated slugs vs `kushy-N`), so a strain in two sources arrives as two ids for
 * the SAME thing. strainKey is the identity every graph bakes and persisted data
 * references, so the union can never hold two nodes per key. The higher-trust
 * node is kept verbatim (its strainType,
 * effects, tier — curated stays a sativa); the duplicate is dropped and the
 * lower-trust source's EDGES are re-pointed onto the surviving node, so community
 * lineage attaches to the verified core instead of a shadow duplicate.
 *
 * Folding two nodes can imply a cycle that existed in neither source, so edges go
 * in through the same reachability guard the kushy adapter uses — compile() hard-
 * fails on any cycle, so we skip the edge that would close a loop.
 */
export function mergeSources(inputs: { src: SourceDef; data: SourceData }[]): {
  strains: Strain[];
  lineage: Lineage[];
  origin: Map<string, Provenance>;
} {
  const strainById = new Map<string, Strain>();
  const origin = new Map<string, Provenance>();
  const canonByKey = new Map<string, string>(); // strainKey -> surviving id
  const idRemap = new Map<string, string>(); // dropped duplicate id -> surviving id
  const remap = (id: string) => idRemap.get(id) ?? id;

  // Stats for the build log.
  let folded = 0;

  // Reachability guard shared across all sources' edges (the union is one DAG).
  const adj = new Map<string, Set<string>>();
  const reaches = (from: string, to: string): boolean => {
    const stack = [from];
    const seen = new Set<string>();
    while (stack.length) {
      const n = stack.pop()!;
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const nxt of adj.get(n) ?? []) stack.push(nxt);
    }
    return false;
  };
  const edgeKeys = new Set<string>();
  const lineage: Lineage[] = [];
  let cyclic = 0;

  for (const { src, data } of inputs) {

    // Strains first: claim each identity by name, or fold onto the higher-trust
    // node already holding it. Build the id remap before this source's edges.
    for (const s of data.strains) {
      const key = strainKey(s.name);
      const owner = canonByKey.get(key);
      if (owner) {
        idRemap.set(s.id, owner); // same strain already claimed — fold, keep winner
        folded++;
        continue;
      }
      strainById.set(s.id, s);
      origin.set(s.id, { source: src.id, confidence: src.confidence });
      canonByKey.set(key, s.id);
    }

    // Edges: re-point both endpoints onto surviving ids, drop self-loops/dupes,
    // and admit only those that keep the union acyclic.
    for (const e of data.lineage) {
      const parent = remap(e.parent);
      const child = remap(e.child);
      if (parent === child) continue; // collapsed onto the same node
      const key = `${parent}->${child}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      if (reaches(child, parent)) {
        cyclic++; // adding parent->child would close a cycle
        continue;
      }
      (adj.get(parent) ?? adj.set(parent, new Set()).get(parent)!).add(child);
      lineage.push({ parent, child });
    }
  }

  console.log(
    `  ↳ union merge: ${folded} cross-source duplicate(s) folded onto higher-trust nodes; ` +
      `${lineage.length} edges (${cyclic} cyclic skipped) over ${strainById.size} nodes.`,
  );

  return { strains: [...strainById.values()], lineage, origin };
}

/**
 * Project a compiled graph into the server-side catalog: one entry per strain,
 * keyed by strainKey, layout stripped, lineage expressed as strainKeys.
 */
export function buildCatalog(graph: DirectedGraph): Catalog {
  const keyOf = (id: string) => graph.getNodeAttribute(id, "strainKey") as string;
  const byKey = (a: string, b: string) => a.localeCompare(b);
  const entries: [string, CatalogEntry][] = graph.mapNodes((id, a) => {
    const entry: CatalogEntry = {
      key: a.strainKey,
      name: a.label,
      strainType: a.strainType,
      effects: a.effects,
      negatives: a.negatives,
      nameKind: a.nameKind,
      source: a.source,
      confidence: a.confidence,
      ...(a.note ? { note: a.note } : {}),
      ...(a.citations ? { citations: a.citations } : {}),
      ...(a.lineageStatus ? { lineageStatus: a.lineageStatus } : {}),
      generation: a.generation,
      descendants: a.descendants,
      parents: graph.inNeighbors(id).map(keyOf).sort(byKey),
      children: graph.outNeighbors(id).map(keyOf).sort(byKey),
    };
    return [a.strainKey, entry];
  });
  entries.sort(([a], [b]) => byKey(a, b));
  return Object.fromEntries(entries);
}

/** One entry per line: stable, reviewable diffs without pretty-print bloat. */
export function serializeCatalog(catalog: Catalog): string {
  const lines = Object.entries(catalog).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  return `{\n${lines.join(",\n")}\n}\n`;
}
