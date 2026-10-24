// Server-side strain catalog (generated/strain-catalog.json, emitted by
// `pnpm build:graph` from the `all` union). Bundled via a static import so it
// ships with the server code — no runtime file reads to trace on Vercel.

import "server-only";

import raw from "@/generated/strain-catalog.json";
import type { Catalog, CatalogEntry } from "./strains";

// Cast once: the JSON's inferred literal type is huge and adds nothing.
const catalog = raw as unknown as Catalog;

export function getCatalogEntry(key: string): CatalogEntry | undefined {
  return Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}

/** Every catalog entry (read-only; do not mutate). */
export function catalogEntries(): CatalogEntry[] {
  return Object.values(catalog);
}

export function hasStrain(key: string): boolean {
  return Object.hasOwn(catalog, key);
}

/** Display name for a key, falling back to the key itself. */
export function strainName(key: string): string {
  return getCatalogEntry(key)?.name ?? key;
}

/** Minimal list for pickers: [{ key, name }] sorted by name. */
export function catalogIndex(): { key: string; name: string; confidence: CatalogEntry["confidence"] }[] {
  return Object.values(catalog)
    .map(({ key, name, confidence }) => ({ key, name, confidence }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every desirable / side-effect tag in the catalog, for the logging form. */
export function catalogVocabulary(): { effects: string[]; negatives: string[] } {
  const effects = new Set<string>();
  const negatives = new Set<string>();
  for (const e of Object.values(catalog)) {
    e.effects.forEach((x) => effects.add(x));
    e.negatives.forEach((x) => negatives.add(x));
  }
  return { effects: [...effects].sort(), negatives: [...negatives].sort() };
}
