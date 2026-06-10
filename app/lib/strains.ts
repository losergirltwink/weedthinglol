// Shared types + constants for the strain graph.
// The curated source data lives in /data/*.json; the build script
// (scripts/build-graph.ts) compiles it into public/graph.json.

export type StrainType = "indica" | "sativa" | "hybrid" | "landrace";

/**
 * Confidence tier of a data source (Phase 4). A gradient from hand-verified
 * (`curated`) to scraped-but-structured (`documented`) to sparse/contested
 * (`crowd`). Drives union-merge precedence and provenance display.
 */
export type Confidence = "curated" | "documented" | "crowd";

/** A curated source record (data/strains.json). No layout/derived fields. */
export interface Strain {
  id: string;
  name: string;
  type: StrainType;
  effects?: string[];
  note?: string;
}

/** A parent -> child relationship (data/lineage.json). */
export interface Lineage {
  parent: string;
  child: string;
}

/** Node attributes baked into graph.json by the build script. */
export interface StrainNodeAttributes {
  label: string;
  // Stored as `strainType` (not `type`) because Sigma reserves the node
  // `type` attribute for the rendering program name.
  strainType: StrainType;
  effects: string[];
  note?: string;
  generation: number;
  descendants: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export const TYPE_COLORS: Record<StrainType, string> = {
  indica: "#8b5cf6", // violet
  sativa: "#22c55e", // green
  hybrid: "#f59e0b", // amber
  landrace: "#a16207", // brown
};

/** Display order for the legend / filters. */
export const STRAIN_TYPES: StrainType[] = ["landrace", "sativa", "hybrid", "indica"];
