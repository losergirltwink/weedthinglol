// Promotion queue ranking (pure; tested). Which non-curated strains most deserve
// verification and promotion into curated? Personal use dominates — strains I've
// actually tried or want to try — then structural value: how many curated
// relatives a crowd strain has (promoting it knits the verified core together).

import type { CatalogEntry } from "./strains";

export interface QueueCandidate {
  key: string;
  name: string;
  origin: "crowd" | "personal";
  score: number;
  reasons: string[];
  /** Parents that aren't curated yet — promote those first to keep edges. */
  uncuratedParents: string[];
}

interface PersonalLike {
  strainKey: string;
  name: string;
  parentKeys: string[];
}

export interface RankInput {
  catalog: CatalogEntry[];
  personal: PersonalLike[];
  /** Journal sessions per strainKey. */
  tried: Map<string, number>;
  wishlist: Set<string>;
  limit?: number;
}

export const WEIGHTS = { tried: 10, wishlist: 5, personal: 3, curatedRelative: 2 } as const;

export function rankCandidates({ catalog, personal, tried, wishlist, limit = 30 }: RankInput): QueueCandidate[] {
  const byKey = new Map(catalog.map((e) => [e.key, e]));
  const isCurated = (k: string) => byKey.get(k)?.confidence === "curated";
  const personalSignal = (key: string, reasons: string[]) => {
    let s = 0;
    const n = tried.get(key) ?? 0;
    if (n) {
      s += WEIGHTS.tried * n;
      reasons.push(`tried ${n}×`);
    }
    if (wishlist.has(key)) {
      s += WEIGHTS.wishlist;
      reasons.push("on want-to-try list");
    }
    return s;
  };

  const out: QueueCandidate[] = [];

  for (const e of catalog) {
    if (e.confidence === "curated") continue;
    const reasons: string[] = [];
    let score = personalSignal(e.key, reasons);
    // Cross-expression nodes ("A x B") are connective tissue, not cultivars to
    // verify — only queue them when they matter to me personally.
    if (e.nameKind === "cross" && score === 0) continue;
    const relatives = [...e.parents, ...e.children].filter(isCurated).length;
    if (relatives) {
      score += WEIGHTS.curatedRelative * relatives;
      reasons.push(`${relatives} curated relative${relatives === 1 ? "" : "s"}`);
    }
    if (score === 0) continue;
    out.push({
      key: e.key,
      name: e.name,
      origin: "crowd",
      score,
      reasons,
      uncuratedParents: e.parents.filter((p) => !isCurated(p)),
    });
  }

  for (const p of personal) {
    if (byKey.has(p.strainKey)) continue; // already promoted (shadowed) — see shadowedPersonal
    const reasons = ["personal strain"];
    const score = WEIGHTS.personal + personalSignal(p.strainKey, reasons);
    out.push({
      key: p.strainKey,
      name: p.name,
      origin: "personal",
      score,
      reasons,
      uncuratedParents: p.parentKeys.filter((k) => !isCurated(k)),
    });
  }

  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Personal strains whose key now resolves to the catalog (promoted): safe to delete. */
export function shadowedPersonal<T extends PersonalLike>(catalog: CatalogEntry[], personal: T[]): T[] {
  const keys = new Set(catalog.map((e) => e.key));
  return personal.filter((p) => keys.has(p.strainKey));
}
