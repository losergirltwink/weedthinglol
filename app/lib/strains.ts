// Dummy dataset for Phase 0 — shape mirrors the real schema so it carries into Phase 1.
// Coordinates are hand-placed here; in Phase 1 they'll be precomputed by a build script.

export type StrainType = "indica" | "sativa" | "hybrid" | "landrace";

export interface Strain {
  id: string;
  name: string;
  type: StrainType;
  x: number;
  y: number;
}

export interface Lineage {
  parent: string; // strain id
  child: string; // strain id
}

export const STRAINS: Strain[] = [
  { id: "og-kush", name: "OG Kush", type: "hybrid", x: -6, y: 4 },
  { id: "durban-poison", name: "Durban Poison", type: "landrace", x: -6, y: -4 },
  { id: "girl-scout-cookies", name: "Girl Scout Cookies", type: "hybrid", x: -1, y: 0 },
  { id: "sunset-sherbet", name: "Sunset Sherbet", type: "hybrid", x: 4, y: 4 },
  { id: "gelato", name: "Gelato", type: "hybrid", x: 5, y: -1 },
  { id: "wedding-cake", name: "Wedding Cake", type: "indica", x: 9, y: -4 },
];

export const LINEAGE: Lineage[] = [
  { parent: "og-kush", child: "girl-scout-cookies" },
  { parent: "durban-poison", child: "girl-scout-cookies" },
  { parent: "girl-scout-cookies", child: "sunset-sherbet" },
  { parent: "girl-scout-cookies", child: "gelato" },
  { parent: "sunset-sherbet", child: "gelato" },
  { parent: "gelato", child: "wedding-cake" },
];

export const TYPE_COLORS: Record<StrainType, string> = {
  indica: "#8b5cf6", // violet
  sativa: "#22c55e", // green
  hybrid: "#f59e0b", // amber
  landrace: "#a16207", // brown
};
