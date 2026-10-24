// Shared types + constants for the strain graph.
// Source data lives in /data/<source>/*.json (see data/sources.ts); the build
// script (scripts/build-graph.ts) compiles each into public/graph.<source>.json.

export type StrainType = "indica" | "sativa" | "hybrid" | "landrace";

/**
 * Confidence tier of a data source (Phase 4). A gradient from hand-verified
 * (`curated`) to scraped-but-structured (`documented`) to sparse/contested
 * (`crowd`). Drives union-merge precedence and provenance display. `personal`
 * (Phase 5) marks strains the owner added from the journal (DB-backed, not part
 * of any baked source; lineage is the owner's own claim).
 */
export type Confidence = "curated" | "documented" | "crowd" | "personal";

/**
 * Effects that are side-effects to AVOID, not desirable traits. Crowd sources
 * (kushy) record these alongside real effects; curated never does. The build
 * partitions a strain's effects against this set into positive `effects` vs
 * `negatives` (see StrainNodeAttributes), so the recommender never treats a
 * shared "dry mouth" as similarity, and can optionally penalize them. Stored
 * lowercase to match the normalized effect tags. Extend as new negatives appear.
 */
export const NEGATIVE_EFFECTS: ReadonlySet<string> = new Set([
  "dry mouth",
  "dry eyes",
  "paranoid",
  "anxious",
  "dizzy",
  "headache",
]);

/** True if an effect tag is a side-effect to avoid rather than a desirable one. */
export const isNegativeEffect = (effect: string): boolean =>
  NEGATIVE_EFFECTS.has(effect.trim().toLowerCase());

/**
 * How well-established a strain's recorded parentage is (Phase 5). `confirmed`:
 * breeder-stated or otherwise well-documented; `reported`: commonly claimed but
 * unverified; `disputed`: sources disagree. Absent = not yet assessed.
 */
export type LineageStatus = "confirmed" | "reported" | "disputed";

export const LINEAGE_STATUSES: readonly LineageStatus[] = ["confirmed", "reported", "disputed"];

/** A reference backing a curated record. `url` must be http(s). */
export interface Citation {
  label: string;
  url: string;
}

/** A curated source record (data/strains.json). No layout/derived fields. */
export interface Strain {
  id: string;
  name: string;
  type: StrainType;
  effects?: string[];
  note?: string;
  citations?: Citation[];
  lineageStatus?: LineageStatus;
}

/** A parent -> child relationship (data/lineage.json). */
export interface Lineage {
  parent: string;
  child: string;
}

/** Node attributes baked into public/graph.<source>.json by the build script. */
export interface StrainNodeAttributes {
  label: string;
  // Stable, source-independent identity (see app/lib/strain-key.ts). Persisted
  // references (reviews, wishlist, URLs) use this, never the node id.
  strainKey: string;
  // Stored as `strainType` (not `type`) because Sigma reserves the node
  // `type` attribute for the rendering program name.
  strainType: StrainType;
  // Desirable effects only — side-effects are split out into `negatives` at
  // bake time (see NEGATIVE_EFFECTS), so effect-similarity never matches on them.
  effects: string[];
  // Side-effects to avoid (dry mouth, paranoid, …); empty for curated data.
  negatives: string[];
  // Entity-kind (derived at bake time): a `named` cultivar vs a `cross`-
  // expression node whose name is literally a cross formula ("A x B") with both
  // parents present in the graph — connective tissue rather than a named strain.
  // Curated nodes are always `named`. Drives a recommender down-weight + a
  // subtle 2D resting de-emphasis. See classifyNameKind in build-graph.ts.
  nameKind: "named" | "cross";
  note?: string;
  citations?: Citation[];
  lineageStatus?: LineageStatus;
  generation: number;
  descendants: number;
  x: number;
  y: number;
  size: number;
  color: string;
  // Provenance (Phase 4): the source this node came from and its trust tier.
  // In a per-source graph these are uniform; in the `all` union they vary.
  source: string;
  confidence: Confidence;
}

export const TYPE_COLORS: Record<StrainType, string> = {
  indica: "#8b5cf6", // violet
  sativa: "#22c55e", // green
  hybrid: "#f59e0b", // amber
  landrace: "#a16207", // brown
};

/** Display metadata per confidence tier — drives the provenance badge + legend. */
export const CONFIDENCE_META: Record<Confidence, { label: string; color: string; blurb: string }> = {
  curated: { label: "Curated", color: "#22c55e", blurb: "Hand-verified" }, // green
  documented: { label: "Documented", color: "#f59e0b", blurb: "Structured scrape" }, // amber
  crowd: { label: "Unverified", color: "#ef4444", blurb: "Community-sourced, not verified" }, // red
  personal: { label: "Personal", color: "#38bdf8", blurb: "Added from the journal, not verified" }, // sky
};

/** Display order for the legend / filters. */
export const STRAIN_TYPES = ["landrace", "sativa", "hybrid", "indica"] as const satisfies readonly StrainType[];

/**
 * One strain in the server-side catalog (generated/strain-catalog.json), keyed
 * by strainKey and built from the `all` union. Strain pages and write-path
 * validation read this instead of the much larger layout graph. Lineage is
 * expressed in strainKeys, never node ids.
 */
export interface CatalogEntry {
  key: string;
  name: string;
  strainType: StrainType;
  effects: string[];
  negatives: string[];
  nameKind: "named" | "cross";
  source: string;
  confidence: Confidence;
  note?: string;
  citations?: Citation[];
  lineageStatus?: LineageStatus;
  generation: number;
  descendants: number;
  parents: string[];
  children: string[];
}

export type Catalog = Record<string, CatalogEntry>;
