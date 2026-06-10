// Leafly-shaped adapter — normalizes a raw scrape into canonical records, then
// applies a hand-authored patch layered over the (never-edited) raw data. The
// real Leafly ingestion will reuse this exact seam; data/expanded-demo exercises
// it today.
//
// Raw record shape (as a scrape would land it — note the field-name + casing
// differences from our canonical Strain):
//   { slug, name, category, effects?: string[], parents?: string[], note? }

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { STRAIN_TYPES, type Strain, type StrainType, type Lineage } from "@/app/lib/strains";
import type { SourceAdapter, SourceData } from "./types";

interface RawRecord {
  slug: string;
  name: string;
  category: string;
  effects?: string[];
  parents?: string[];
  note?: string;
}

interface Patch {
  dropStrains?: string[];
  dropEdges?: Lineage[];
  overrideStrains?: Array<Partial<Strain> & { id: string }>;
  addStrains?: Strain[];
  addEdges?: Lineage[];
}

const TYPE_SET = new Set<string>(STRAIN_TYPES);

/** Coerce a scraped category string to a StrainType; unknowns fall back. */
const normalizeType = (category: string): StrainType => {
  const t = category.trim().toLowerCase();
  return (TYPE_SET.has(t) ? t : "hybrid") as StrainType;
};

const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8")) as T;

/** Build an adapter for a Leafly-shaped source rooted at data/<dir>/. */
export function makeLeaflyAdapter(id: string, dir: string): SourceAdapter {
  return {
    id,
    load: (): SourceData => {
      const raw = read<RawRecord[]>(`data/${dir}/raw/leafly-sample.json`);
      const patch = read<Patch>(`data/${dir}/patch.json`);

      // 1. Normalize raw -> canonical strains + lineage.
      const strainById = new Map<string, Strain>();
      let lineage: Lineage[] = [];
      for (const r of raw) {
        strainById.set(r.slug, {
          id: r.slug,
          name: r.name,
          type: normalizeType(r.category),
          effects: (r.effects ?? []).map((e) => e.toLowerCase()),
          ...(r.note ? { note: r.note } : {}),
        });
        for (const parent of r.parents ?? []) {
          lineage.push({ parent, child: r.slug });
        }
      }

      // 2. Apply patch over raw (the only place hand-fixes live).
      // 2a. Drop strains — and any edge that touches a dropped strain.
      if (patch.dropStrains?.length) {
        const dropped = new Set(patch.dropStrains);
        for (const id of dropped) strainById.delete(id);
        lineage = lineage.filter((e) => !dropped.has(e.parent) && !dropped.has(e.child));
      }
      // 2b. Drop specific edges.
      if (patch.dropEdges?.length) {
        const keys = new Set(patch.dropEdges.map((e) => `${e.parent}->${e.child}`));
        lineage = lineage.filter((e) => !keys.has(`${e.parent}->${e.child}`));
      }
      // 2c. Override fields on existing strains (shallow merge by id).
      for (const ov of patch.overrideStrains ?? []) {
        const base = strainById.get(ov.id);
        if (base) strainById.set(ov.id, { ...base, ...ov });
      }
      // 2d. Add strains / edges the scrape missed entirely.
      for (const s of patch.addStrains ?? []) strainById.set(s.id, s);
      if (patch.addEdges?.length) lineage.push(...patch.addEdges);

      return { strains: [...strainById.values()], lineage };
    },
  };
}
