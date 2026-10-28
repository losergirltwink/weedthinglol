// The personal overlay (Phase 5D): everything the explorer needs to layer my
// journal over the static graph, in one payload from GET /api/overlay. Keyed by
// strainKey, never node ids. Dependency-free so client code can import it.

import type { Affinity, GroupStat, LineageAffinity } from "./profile";
import type { StrainType } from "./strains";

export interface Overlay {
  isOwner: boolean;
  /** Per-strain rating summary over the sessions this viewer may see. */
  ratings: Record<string, { avgHalves: number; sessions: number }>;
  wishlist: string[];
  /** Personal strains not (yet) in the catalog — inserted into the graph client-side. */
  personal: { key: string; name: string; strainType: StrainType; parents: string[] }[];
  profile: {
    coldStart: boolean;
    meanRating: number | null;
    effects: Affinity[];
    lineage: LineageAffinity[];
    types: GroupStat[];
    sideEffects: { tag: string; sessions: number; share: number }[];
  };
}

// Ring colors for the graph overlay (dataviz diverging pair + aqua identity),
// validated together against the graph background #09090b. Aqua vs red sits in
// the CVD warn band, so want-to-try also differs by ring WIDTH and is named in
// the legend + detail panel (never color alone); it never co-occurs with a
// rating ring (want-to-try = untried).
export const RING = {
  above: "#3987e5",
  below: "#e66767",
  neutral: "#a1a1aa",
  wishlist: "#199e70",
} as const;
