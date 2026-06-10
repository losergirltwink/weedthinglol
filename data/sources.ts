// Source registry (Phase 4) — the single source of truth for which datasets
// exist, shared by BOTH the build (scripts/build-graph.ts, to know what to
// compile) and the client (to populate the source dropdown). No generated
// manifest: add a source here and it flows through both sides.
//
// Each real source lives under data/<dir>/ and compiles to its own offline-baked
// public/graph.<id>.json. The `all` union (ALL_SOURCE) is produced by merging the
// real sources with curated-wins precedence — it has no input dir of its own.

import type { Confidence } from "@/app/lib/strains";

export interface SourceDef {
  /** Stable id; names the output file public/graph.<id>.json. */
  id: string;
  /** Human label for the dropdown. */
  label: string;
  /** Confidence tier; drives union precedence + provenance display. */
  confidence: Confidence;
  /** Directory under data/ holding this source's inputs. */
  dir: string;
}

/**
 * Real, independently-compiled sources. Order is the confidence precedence used
 * by the union build: earlier entries win on conflict (curated > documented >
 * crowd). The expanded/crowd tiers are added in later Phase 4 steps.
 */
export const SOURCES: SourceDef[] = [
  { id: "curated", label: "Curated", confidence: "curated", dir: "curated" },
];

/** The union pseudo-source: merge of SOURCES, provenance-tagged. Built step 3. */
export const ALL_SOURCE = { id: "all", label: "All sources" } as const;

/** Source the explorer loads on first paint. */
export const DEFAULT_SOURCE = "curated";

/** Look up a source definition by id. */
export const sourceById = (id: string): SourceDef | undefined =>
  SOURCES.find((s) => s.id === id);
