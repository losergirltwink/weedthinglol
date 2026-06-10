// Shared types + constants for the strain graph.
// The curated source data lives in /data/*.json; the build script
// (scripts/build-graph.ts) compiles it into public/graph.json.

export type StrainType = "indica" | "sativa" | "hybrid" | "landrace";

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
  type: StrainType;
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
