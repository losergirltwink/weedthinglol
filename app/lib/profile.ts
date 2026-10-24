// Taste profile (Phase 5D): what my ratings say I like. Pure and renderer-
// agnostic — the /profile page and (next) the recommender's "for me" mode both
// consume it.
//
// Every session is centered on my own mean: w = rating − μ (in stars). A 4★
// session when I average 3★ is +1; a 2★ one is −1. Signals accumulate w, so they
// reflect what separates my good sessions from my bad ones, not just what I log
// a lot. Lineage affinity propagates w to ancestors with decay 0.5^hops — that's
// what surfaces "you love Haze descendants".

import type { StrainType } from "./strains";

export interface ProfileSession {
  strainKey: string;
  ratingHalves: number;
  effectsFelt: string[];
  negativesFelt: string[];
  flavors: string[];
  terpenes: string[];
  method: string | null;
  wouldBuyAgain: boolean | null;
}

export interface ProfileStrain {
  name: string;
  strainType: StrainType;
  /** The strain's listed (desirable) effects — fallback when a session tagged none. */
  effects: string[];
  parents: string[];
}

export interface Affinity {
  tag: string;
  /** Σ w over sessions carrying the tag (stars relative to my mean). */
  score: number;
  /** Sessions carrying the tag. */
  sessions: number;
}

export interface LineageAffinity {
  key: string;
  name: string;
  score: number;
  /** Rated strains descending from this ancestor. */
  via: string[];
}

export interface GroupStat {
  group: string;
  /** Mean rating in stars. */
  avg: number;
  sessions: number;
}

export interface StrainStat {
  key: string;
  name: string;
  avg: number;
  sessions: number;
}

export interface TasteProfile {
  sessions: number;
  strainsTried: number;
  /** Mean rating in stars, or null with no sessions. */
  meanRating: number | null;
  /** Below this many sessions the affinities are noise — show "keep logging". */
  coldStart: boolean;
  effects: Affinity[];
  /** Side effects by how often I report them (not weighted by rating). */
  sideEffects: { tag: string; sessions: number; share: number }[];
  flavors: Affinity[];
  terpenes: Affinity[];
  lineage: LineageAffinity[];
  types: GroupStat[];
  methods: GroupStat[];
  topStrains: StrainStat[];
  bottomStrains: StrainStat[];
  wouldBuyAgain: { yes: number; no: number };
}

export const COLD_START_SESSIONS = 5;
const LINEAGE_DECAY = 0.5;
const LINEAGE_MAX_HOPS = 6;
/** An ancestor needs this many distinct rated descendants to count as a pattern. */
const LINEAGE_MIN_VIA = 2;
const EPS = 1e-9;

export function computeProfile(
  sessions: ProfileSession[],
  lookup: (key: string) => ProfileStrain | undefined,
): TasteProfile {
  const n = sessions.length;
  const stars = (s: ProfileSession) => s.ratingHalves / 2;
  const mean = n ? sessions.reduce((a, s) => a + stars(s), 0) / n : null;
  const w = (s: ProfileSession) => stars(s) - (mean ?? 0);

  const effects = new Tally();
  const flavors = new Tally();
  const terpenes = new Tally();
  const sideCounts = new Map<string, number>();
  const lineage = new Map<string, { score: number; via: Set<string> }>();
  const byType = new Groups();
  const byMethod = new Groups();
  const byStrain = new Groups();
  const buy = { yes: 0, no: 0 };

  for (const s of sessions) {
    const strain = lookup(s.strainKey);
    const weight = w(s);
    effects.add(s.effectsFelt.length ? s.effectsFelt : (strain?.effects ?? []), weight);
    flavors.add(s.flavors, weight);
    terpenes.add(s.terpenes, weight);
    for (const t of new Set(s.negativesFelt)) sideCounts.set(t, (sideCounts.get(t) ?? 0) + 1);
    if (strain) byType.add(strain.strainType, stars(s));
    if (s.method) byMethod.add(s.method, stars(s));
    byStrain.add(s.strainKey, stars(s));
    if (s.wouldBuyAgain === true) buy.yes++;
    if (s.wouldBuyAgain === false) buy.no++;

    for (const [anc, hops] of ancestorsWithHops(s.strainKey, lookup)) {
      const cur = lineage.get(anc) ?? { score: 0, via: new Set<string>() };
      cur.score += weight * LINEAGE_DECAY ** hops;
      cur.via.add(s.strainKey);
      lineage.set(anc, cur);
    }
  }

  const nameOf = (k: string) => lookup(k)?.name ?? k;
  const strainStats = byStrain.stats().map((g) => ({ key: g.group, name: nameOf(g.group), avg: g.avg, sessions: g.sessions }));
  const ranked = [...strainStats].sort((a, b) => b.avg - a.avg || b.sessions - a.sessions || a.name.localeCompare(b.name));

  return {
    sessions: n,
    strainsTried: strainStats.length,
    meanRating: mean,
    coldStart: n < COLD_START_SESSIONS,
    effects: effects.result(),
    sideEffects: [...sideCounts]
      .map(([tag, c]) => ({ tag, sessions: c, share: c / n }))
      .sort((a, b) => b.sessions - a.sessions || a.tag.localeCompare(b.tag)),
    flavors: flavors.result(),
    terpenes: terpenes.result(),
    lineage: [...lineage]
      .filter(([, v]) => v.via.size >= LINEAGE_MIN_VIA && Math.abs(v.score) > EPS)
      .map(([key, v]) => ({ key, name: nameOf(key), score: v.score, via: [...v.via].map(nameOf).sort() }))
      .sort(byMagnitude),
    types: byType.stats(),
    methods: byMethod.stats(),
    // Top/bottom only mean something with a spread of strains; never overlap.
    topStrains: ranked.length >= 2 ? ranked.slice(0, 5) : [],
    bottomStrains: ranked.length >= 4 ? ranked.slice(-Math.min(5, Math.floor(ranked.length / 2))).reverse() : [],
    wouldBuyAgain: buy,
  };
}

/** Strongest signal first, positive before negative on ties. */
function byMagnitude(a: { score: number }, b: { score: number }) {
  return Math.abs(b.score) - Math.abs(a.score) || b.score - a.score;
}

class Tally {
  private m = new Map<string, Affinity>();
  add(tags: string[], weight: number) {
    for (const tag of new Set(tags)) {
      const cur = this.m.get(tag) ?? { tag, score: 0, sessions: 0 };
      cur.score += weight;
      cur.sessions++;
      this.m.set(tag, cur);
    }
  }
  result(): Affinity[] {
    return [...this.m.values()].filter((a) => Math.abs(a.score) > EPS).sort((a, b) => byMagnitude(a, b) || a.tag.localeCompare(b.tag));
  }
}

class Groups {
  private m = new Map<string, { sum: number; n: number }>();
  add(group: string, value: number) {
    const cur = this.m.get(group) ?? { sum: 0, n: 0 };
    cur.sum += value;
    cur.n++;
    this.m.set(group, cur);
  }
  stats(): GroupStat[] {
    return [...this.m]
      .map(([group, { sum, n }]) => ({ group, avg: sum / n, sessions: n }))
      .sort((a, b) => b.avg - a.avg || b.sessions - a.sessions || a.group.localeCompare(b.group));
  }
}

/** Ancestors of `key` with their SHORTEST hop distance (1 = parent). */
function ancestorsWithHops(key: string, lookup: (k: string) => ProfileStrain | undefined): Map<string, number> {
  const hops = new Map<string, number>();
  let frontier = [key];
  for (let depth = 1; depth <= LINEAGE_MAX_HOPS && frontier.length; depth++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const p of lookup(k)?.parents ?? []) {
        if (p === key || hops.has(p)) continue;
        hops.set(p, depth);
        next.push(p);
      }
    }
    frontier = next;
  }
  return hops;
}
