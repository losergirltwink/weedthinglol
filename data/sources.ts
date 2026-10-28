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
  /** Where the data comes from + what of it we ship; shown with provenance. */
  attribution: string;
}

/**
 * Real, independently-compiled sources. Order is the confidence precedence used
 * by the union build: earlier entries win on conflict (curated > documented >
 * crowd).
 */
export const SOURCES: SourceDef[] = [
  {
    id: "curated",
    label: "Curated",
    confidence: "curated",
    dir: "curated",
    attribution: "Hand-authored for this project.",
  },
  {
    id: "kushy",
    label: "Unverified (2017 community)",
    confidence: "crowd",
    dir: "kushy",
    attribution:
      "Kushy community strain dataset (Nov 2017 snapshot). Names, types, lineage and " +
      "effect tags only; lineage partly inferred from cross-style names. Unverified and " +
      "frozen in 2017, so modern strains are missing.",
  },
];

/** The union pseudo-source: merge of SOURCES, provenance-tagged. */
export const ALL_SOURCE = { id: "all", label: "All sources" } as const;

/** Source the explorer loads on first paint. */
export const DEFAULT_SOURCE = "curated";

/** A selectable entry in the source dropdown. */
export interface SourceOption {
  id: string;
  label: string;
}

/**
 * Sources offered to the UI: every real source, plus the `all` union — but only
 * once there's more than one real source, since a union of one is redundant.
 */
export const AVAILABLE_SOURCES: readonly SourceOption[] = [
  ...SOURCES.map(({ id, label }) => ({ id, label })),
  ...(SOURCES.length > 1 ? [{ id: ALL_SOURCE.id, label: ALL_SOURCE.label }] : []),
];

/** Look up a source definition by id. */
export const sourceById = (id: string): SourceDef | undefined =>
  SOURCES.find((s) => s.id === id);
