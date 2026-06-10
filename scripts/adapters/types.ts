// SourceAdapter contract (Phase 4) — the standardized input point. Any dataset,
// however messy at rest, becomes a buildable source by implementing `load()` to
// return the canonical { strains, lineage } shape. Everything downstream
// (validation, derived fields, layout bake, both renderers) is then free.

import type { Strain, Lineage } from "@/app/lib/strains";

export interface SourceData {
  strains: Strain[];
  lineage: Lineage[];
}

export interface SourceAdapter {
  /** Must match a SourceDef id in data/sources.ts. */
  id: string;
  /** Produce canonical records from this source's raw inputs. */
  load(): SourceData;
}
