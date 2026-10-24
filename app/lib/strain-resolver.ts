// One answer to "what strain is this key?" across both homes: the baked catalog
// (every source, curated-wins) and the owner's DB-backed personal strains.
// Catalog wins on a key collision — a promoted personal strain resolves to its
// curated record, and its stale personal row is flagged on /queue.

import "server-only";

import { inArray } from "drizzle-orm";

import type { Db } from "@/db/client";
import { personalStrain } from "@/db/schema";
import { catalogIndex, getCatalogEntry, hasStrain } from "./catalog";
import { getPersonalStrain, listPersonalStrains, personalChildrenOf, type PersonalStrain } from "./personal/queries";
import type { ProfileStrain } from "./profile";
import type { CatalogEntry, Confidence } from "./strains";

export interface ResolvedStrain extends CatalogEntry {
  /** Set only for personal strains: the owner's notes about it. */
  personalNotes?: string | null;
}

export async function resolveStrain(db: Db, key: string): Promise<ResolvedStrain | undefined> {
  const catalogEntry = getCatalogEntry(key);
  const personalKids = (await personalChildrenOf(db, key)).map((p) => p.strainKey);
  if (catalogEntry) {
    return { ...catalogEntry, children: [...catalogEntry.children, ...personalKids] };
  }
  const p = await getPersonalStrain(db, key);
  if (!p) return undefined;
  return {
    key: p.strainKey,
    name: p.name,
    strainType: p.strainType,
    effects: [],
    negatives: [],
    nameKind: "named",
    source: "personal",
    confidence: "personal",
    generation: generationOf(p, await listPersonalStrains(db)),
    descendants: personalKids.length,
    parents: p.parentKeys,
    children: personalKids,
    personalNotes: p.notes,
  };
}

/** Does `key` name a strain anywhere (catalog or personal)? */
export async function strainExists(db: Db, key: string): Promise<boolean> {
  return hasStrain(key) || !!(await getPersonalStrain(db, key));
}

/** Display names for many keys at once (one DB query for the misses). */
export async function strainNames(db: Db, keys: Iterable<string>): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const misses: string[] = [];
  for (const k of new Set(keys)) {
    const c = getCatalogEntry(k);
    if (c) names.set(k, c.name);
    else misses.push(k);
  }
  if (misses.length) {
    const rows = await db
      .select({ k: personalStrain.strainKey, name: personalStrain.name })
      .from(personalStrain)
      .where(inArray(personalStrain.strainKey, misses));
    for (const r of rows) names.set(r.k, r.name);
  }
  return names;
}

export interface PickerOption {
  key: string;
  name: string;
  confidence: Confidence;
}

/** Every pickable strain: catalog + personal (personal shadowed by catalog skipped). */
export async function strainOptions(db: Db): Promise<PickerOption[]> {
  const personal = (await listPersonalStrains(db))
    .filter((p) => !hasStrain(p.strainKey))
    .map((p) => ({ key: p.strainKey, name: p.name, confidence: "personal" as const }));
  return [...catalogIndex(), ...personal].sort((a, b) => a.name.localeCompare(b.name));
}

/** Longest parent chain, counting catalog generations; cycle-safe. */
function generationOf(p: PersonalStrain, all: PersonalStrain[]): number {
  const byKey = new Map(all.map((x) => [x.strainKey, x]));
  const memo = new Map<string, number>();
  const gen = (key: string, visiting: Set<string>): number => {
    const c = getCatalogEntry(key);
    if (c) return c.generation;
    if (memo.has(key)) return memo.get(key)!;
    const node = byKey.get(key);
    if (!node || visiting.has(key)) return 0;
    visiting.add(key);
    const g = node.parentKeys.length ? 1 + Math.max(...node.parentKeys.map((k) => gen(k, visiting))) : 0;
    visiting.delete(key);
    memo.set(key, g);
    return g;
  };
  return gen(p.strainKey, new Set());
}

/** Strain lookup for the taste profile: catalog + personal (catalog wins). */
export async function profileLookup(db: Db): Promise<(key: string) => ProfileStrain | undefined> {
  const personal = new Map((await listPersonalStrains(db)).map((p) => [p.strainKey, p]));
  return (key) => {
    const c = getCatalogEntry(key);
    if (c) return { name: c.name, strainType: c.strainType, effects: c.effects, parents: c.parents };
    const p = personal.get(key);
    return p ? { name: p.name, strainType: p.strainType, effects: [], parents: p.parentKeys } : undefined;
  };
}
