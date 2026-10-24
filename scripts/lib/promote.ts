// Promotion planning: turn a crowd or personal strain into a curated record +
// edges. Pure (no I/O) so it's unit-tested; scripts/promote.ts does the I/O.
//
// A promoted record starts honest: lineageStatus "reported" and no citations
// (so the build's citation warning keeps flagging it until you verify it).
// Edges are only added to parents that are ALREADY curated — anything else is
// reported as `missingParents` (promote those first), never a dangling edge.

import { strainKey } from "../../app/lib/strain-key";
import type { Lineage, Strain, StrainType } from "../../app/lib/strains";

export interface PromotionSource {
  key: string;
  name: string;
  strainType: StrainType;
  effects: string[];
  /** Parents as strainKeys. */
  parents: string[];
  origin: "crowd" | "personal";
}

export type PromotionPlan =
  | { ok: true; record: Strain; edges: Lineage[]; missingParents: string[] }
  | { ok: false; error: string };

export function planPromotion(src: PromotionSource, curated: Strain[]): PromotionPlan {
  const idByKey = new Map(curated.map((s) => [strainKey(s.name), s.id]));
  const existing = idByKey.get(src.key);
  if (existing) return { ok: false, error: `"${src.name}" is already curated (id "${existing}").` };
  if (curated.some((s) => s.id === src.key)) {
    return { ok: false, error: `A curated record already uses the id "${src.key}".` };
  }

  const edges: Lineage[] = [];
  const missingParents: string[] = [];
  for (const p of src.parents) {
    const parentId = idByKey.get(p);
    if (parentId) edges.push({ parent: parentId, child: src.key });
    else missingParents.push(p);
  }

  return {
    ok: true,
    record: {
      id: src.key,
      name: src.name,
      type: src.strainType,
      ...(src.effects.length ? { effects: src.effects } : {}),
      lineageStatus: "reported",
    },
    edges,
    missingParents,
  };
}
