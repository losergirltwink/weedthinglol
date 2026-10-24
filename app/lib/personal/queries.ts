// Personal-strain data access (takes db; testable on PGlite).

import { arrayContains, asc, count, eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import { journalEntry, personalStrain, wishlistItem } from "@/db/schema";
import type { PersonalStrainInput } from "./input";

export type PersonalStrain = typeof personalStrain.$inferSelect;

export async function createPersonalStrain(
  db: Db,
  key: string,
  input: PersonalStrainInput,
): Promise<PersonalStrain> {
  const [row] = await db.insert(personalStrain).values({ strainKey: key, ...input }).returning();
  return row;
}

export async function updatePersonalStrain(
  db: Db,
  key: string,
  input: PersonalStrainInput,
): Promise<PersonalStrain | undefined> {
  const [row] = await db
    .update(personalStrain)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(personalStrain.strainKey, key))
    .returning();
  return row;
}

export async function deletePersonalStrain(db: Db, key: string): Promise<boolean> {
  const rows = await db.delete(personalStrain).where(eq(personalStrain.strainKey, key)).returning();
  return rows.length > 0;
}

export async function getPersonalStrain(db: Db, key: string): Promise<PersonalStrain | undefined> {
  const [row] = await db.select().from(personalStrain).where(eq(personalStrain.strainKey, key)).limit(1);
  return row;
}

export async function listPersonalStrains(db: Db): Promise<PersonalStrain[]> {
  return db.select().from(personalStrain).orderBy(asc(personalStrain.name));
}

/** Personal strains that name `key` as a parent. */
export async function personalChildrenOf(db: Db, key: string): Promise<PersonalStrain[]> {
  return db
    .select()
    .from(personalStrain)
    .where(arrayContains(personalStrain.parentKeys, [key]))
    .orderBy(asc(personalStrain.name));
}

/** What still points at `key` — used to refuse deleting a strain in use. */
export async function personalStrainUsage(db: Db, key: string) {
  const [[entries], [wish], children] = await Promise.all([
    db.select({ n: count() }).from(journalEntry).where(eq(journalEntry.strainKey, key)),
    db.select({ n: count() }).from(wishlistItem).where(eq(wishlistItem.strainKey, key)),
    personalChildrenOf(db, key),
  ]);
  return { entries: entries.n, wishlisted: wish.n > 0, children: children.map((c) => c.strainKey) };
}

/**
 * Would giving `key` these parents create a cycle through personal strains?
 * Walks UP from each proposed parent along personal `parent_keys`; reaching
 * `key` means `key` would become its own ancestor. Catalog strains are acyclic
 * and never have personal parents, so only personal edges need checking.
 */
export async function wouldCreateCycle(db: Db, key: string, parentKeys: string[]): Promise<boolean> {
  const all = await db
    .select({ k: personalStrain.strainKey, parents: personalStrain.parentKeys })
    .from(personalStrain);
  const parentsOf = new Map(all.map((r) => [r.k, r.parents]));
  const stack = [...parentKeys];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === key) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(parentsOf.get(n) ?? []));
  }
  return false;
}
