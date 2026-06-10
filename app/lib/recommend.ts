// Strain recommendation scoring.
//
// Two entry points share one core (`recommend`):
//   • seed a strain you like  -> blend effect similarity + lineage proximity
//   • pick effects you want    -> rank purely by effect similarity
//
// Everything runs in-browser against the static graph; no persistence,
// no network. The "profile" is just the arguments passed in.

import type { StrainGraphType } from "./graph-utils";

export interface Recommendation {
  id: string;
  label: string;
  /** Blended 0..1 score used for ranking (after negative penalties). */
  score: number;
  /** Jaccard overlap of desirable effects, 0..1. */
  effectScore: number;
  /** Graph-proximity component, 0..1 (0 when in effects-only mode). */
  lineageScore: number;
  /** Effects shared with the target profile. */
  sharedEffects: string[];
  /** Candidate's side-effects — shown muted, and the basis for avoid penalties. */
  negatives: string[];
  /** Hop distance from the seed across lineage; null in effects-only mode. */
  distance: number | null;
  /** Which signal drove the match, for a plain-language "why". */
  driver: "effect" | "lineage" | "both";
  /** Nearest shared ancestor (the "why they're related"), seed mode only. */
  commonAncestor: { id: string; label: string } | null;
}

// Seed mode blends three signals; effects-only mode collapses to effects alone.
const DEFAULT_EFFECT_WEIGHT = 0.6;
const DEFAULT_LINEAGE_WEIGHT = 0.3;
const DEFAULT_TYPE_WEIGHT = 0.1; // a gentle nudge toward the seed's strain type

// Side-effect penalties (multiplicative, so they only ever shrink a score).
const AVOID_PENALTY = 0.45; // per explicitly-avoided side-effect a candidate carries
const NEW_NEGATIVE_PENALTY = 0.2; // per side-effect the candidate adds that the seed lacked
// Cross-expression nodes ("Blueberry x Haze") aren't named cultivars you can go
// find — gently down-weight them as targets so named strains rise, without
// hiding a strong cross entirely.
const CROSS_TARGET_PENALTY = 0.6;

interface RecommendOpts {
  /** A strain to find neighbors of. Enables the lineage + type components. */
  seedId?: string | null;
  /** Explicit desired effects. Defaults to the seed strain's effects. */
  effects?: Iterable<string>;
  /** Side-effects to steer away from — candidates carrying them are penalized. */
  avoid?: Iterable<string>;
  effectWeight?: number;
  lineageWeight?: number;
  typeWeight?: number;
  limit?: number;
}

/** Ranked recommendations for a target profile (seed strain and/or effects). */
export function recommend(
  graph: StrainGraphType,
  opts: RecommendOpts,
): Recommendation[] {
  const { seedId = null, limit = 8 } = opts;
  const hasSeed = seedId != null && graph.hasNode(seedId);

  const targetEffects = new Set<string>(
    opts.effects ?? (hasSeed ? graph.getNodeAttribute(seedId!, "effects") : []),
  );
  const avoid = new Set<string>(
    [...(opts.avoid ?? [])].map((e) => e.trim().toLowerCase()),
  );
  const seedType = hasSeed ? graph.getNodeAttribute(seedId!, "strainType") : null;
  // A strain you like, you've accepted its side-effects; only NEW ones count.
  const seedNegatives = new Set<string>(
    hasSeed ? graph.getNodeAttribute(seedId!, "negatives") : [],
  );

  // Effects-only discovery has no seed, so it can't use lineage or type.
  let effectWeight = opts.effectWeight ?? DEFAULT_EFFECT_WEIGHT;
  let lineageWeight = opts.lineageWeight ?? DEFAULT_LINEAGE_WEIGHT;
  let typeWeight = opts.typeWeight ?? DEFAULT_TYPE_WEIGHT;
  if (!hasSeed) {
    effectWeight = 1;
    lineageWeight = 0;
    typeWeight = 0;
  }
  const weightSum = effectWeight + lineageWeight + typeWeight || 1;

  const distances = hasSeed ? distancesFrom(graph, seedId!) : null;

  const recs: Recommendation[] = [];
  graph.forEachNode((id, attrs) => {
    if (id === seedId) return;

    const { score: effectScore, shared } = jaccard(
      targetEffects,
      new Set(attrs.effects),
    );

    const dist = distances?.get(id);
    const lineageScore = dist == null || dist === 0 ? 0 : 1 / (1 + dist);
    const typeMatch = hasSeed && attrs.strainType === seedType ? 1 : 0;

    let score =
      (effectWeight * effectScore +
        lineageWeight * lineageScore +
        typeWeight * typeMatch) /
      weightSum;

    // Side-effect penalties shrink the blended score. Explicitly-avoided effects
    // hit hard; side-effects the candidate adds beyond the seed's hit gently.
    const negatives = attrs.negatives ?? [];
    if (avoid.size) {
      const hits = negatives.reduce((n, e) => n + (avoid.has(e) ? 1 : 0), 0);
      if (hits) score *= AVOID_PENALTY ** hits;
    }
    if (hasSeed) {
      const added = negatives.reduce((n, e) => n + (seedNegatives.has(e) ? 0 : 1), 0);
      if (added) score *= 1 / (1 + NEW_NEGATIVE_PENALTY * added);
    }
    // A cross-expression target is connective tissue, not a strain to seek out.
    if (attrs.nameKind === "cross") score *= CROSS_TARGET_PENALTY;

    if (score <= 0) return;

    // Plain-language "why": which signal actually carried this pick.
    const byEffect = effectScore > 0;
    const byLineage = lineageScore > 0;
    const driver: Recommendation["driver"] =
      byEffect && byLineage ? "both" : byLineage ? "lineage" : "effect";

    recs.push({
      id,
      label: attrs.label,
      score,
      effectScore,
      lineageScore,
      sharedEffects: shared,
      negatives,
      distance: dist ?? null,
      driver,
      commonAncestor: hasSeed
        ? nearestCommonAncestor(graph, seedId!, id)
        : null,
    });
  });

  recs.sort((a, b) => b.score - a.score || b.effectScore - a.effectScore);
  return recs.slice(0, limit);
}

/** Every distinct desirable-effect tag in the graph, sorted — for the effect picker. */
export function allEffects(graph: StrainGraphType): string[] {
  const set = new Set<string>();
  graph.forEachNode((_, attrs) => attrs.effects.forEach((e) => set.add(e)));
  return [...set].sort();
}

/** Every distinct side-effect tag in the graph, sorted — for the avoid picker. */
export function negativeEffects(graph: StrainGraphType): string[] {
  const set = new Set<string>();
  graph.forEachNode((_, attrs) => (attrs.negatives ?? []).forEach((e) => set.add(e)));
  return [...set].sort();
}

// --- internals --------------------------------------------------------------

function jaccard(
  a: Set<string>,
  b: Set<string>,
): { score: number; shared: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };
  const shared: string[] = [];
  for (const e of a) if (b.has(e)) shared.push(e);
  const union = a.size + b.size - shared.length;
  return { score: union === 0 ? 0 : shared.length / union, shared };
}

/** Undirected BFS hop-counts from the seed across parent + child edges. */
function distancesFrom(
  graph: StrainGraphType,
  seedId: string,
): Map<string, number> {
  const dist = new Map<string, number>([[seedId, 0]]);
  let frontier = [seedId];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next: string[] = [];
    for (const node of frontier) {
      graph.forEachNeighbor(node, (m) => {
        if (!dist.has(m)) {
          dist.set(m, depth);
          next.push(m);
        }
      });
    }
    frontier = next;
  }
  return dist;
}

/** All ancestors of `id` walking parent edges up (excludes `id` itself). */
function ancestors(graph: StrainGraphType, id: string): Set<string> {
  const set = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const node = stack.pop()!;
    graph.forEachInNeighbor(node, (parent) => {
      if (!set.has(parent)) {
        set.add(parent);
        stack.push(parent);
      }
    });
  }
  return set;
}

/** Deepest (most specific) ancestor shared by two strains, if any. */
function nearestCommonAncestor(
  graph: StrainGraphType,
  a: string,
  b: string,
): { id: string; label: string } | null {
  const ancB = ancestors(graph, b);
  let best: string | null = null;
  let bestGen = -1;
  for (const x of ancestors(graph, a)) {
    if (!ancB.has(x)) continue;
    const gen = graph.getNodeAttribute(x, "generation");
    if (gen > bestGen) {
      bestGen = gen;
      best = x;
    }
  }
  return best
    ? { id: best, label: graph.getNodeAttribute(best, "label") }
    : null;
}
