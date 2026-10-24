// Journal data access. Takes the db explicitly (no `server-only`) so it's
// testable against PGlite; server actions and pages call it with getDb().
// Visibility is decided HERE via `includePrivate` — callers pass
// `viewer.isOwner`, never a client-supplied flag.

import { and, avg, count, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "@/db/client";
import { journalEntry, wishlistItem } from "@/db/schema";
import type { WishlistSource } from "./constants";
import type { EntryInput } from "./input";

export type JournalEntry = typeof journalEntry.$inferSelect;
export type WishlistItem = typeof wishlistItem.$inferSelect;

const visible = (includePrivate: boolean) => (includePrivate ? undefined : eq(journalEntry.isPublic, true));

export async function createEntry(db: Db, input: EntryInput): Promise<JournalEntry> {
  const [row] = await db.insert(journalEntry).values(input).returning();
  return row;
}

export async function updateEntry(db: Db, id: string, input: EntryInput): Promise<JournalEntry | undefined> {
  const [row] = await db
    .update(journalEntry)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(journalEntry.id, id))
    .returning();
  return row;
}

export async function deleteEntry(db: Db, id: string): Promise<JournalEntry | undefined> {
  const [row] = await db.delete(journalEntry).where(eq(journalEntry.id, id)).returning();
  return row;
}

export async function getEntry(
  db: Db,
  id: string,
  { includePrivate }: { includePrivate: boolean },
): Promise<JournalEntry | undefined> {
  const [row] = await db
    .select()
    .from(journalEntry)
    .where(and(eq(journalEntry.id, id), visible(includePrivate)))
    .limit(1);
  return row;
}

export async function listEntries(
  db: Db,
  { includePrivate, strainKey, limit = 200 }: { includePrivate: boolean; strainKey?: string; limit?: number },
): Promise<JournalEntry[]> {
  return db
    .select()
    .from(journalEntry)
    .where(and(visible(includePrivate), strainKey ? eq(journalEntry.strainKey, strainKey) : undefined))
    .orderBy(desc(journalEntry.consumedOn), desc(journalEntry.createdAt))
    .limit(limit);
}

export interface StrainSummary {
  sessions: number;
  /** Mean rating in half-star units, or null when never rated. */
  avgHalves: number | null;
  /** Felt effects by frequency, most common first. */
  topEffects: { effect: string; count: number }[];
}

export async function strainSummary(
  db: Db,
  strainKey: string,
  { includePrivate }: { includePrivate: boolean },
): Promise<StrainSummary> {
  const where = and(eq(journalEntry.strainKey, strainKey), visible(includePrivate));
  const [agg] = await db
    .select({ sessions: count(), avg: avg(journalEntry.ratingHalves) })
    .from(journalEntry)
    .where(where);
  const rows = await db.select({ effects: journalEntry.effectsFelt }).from(journalEntry).where(where);
  const tally = new Map<string, number>();
  for (const r of rows) for (const e of r.effects) tally.set(e, (tally.get(e) ?? 0) + 1);
  return {
    sessions: agg.sessions,
    avgHalves: agg.avg == null ? null : Number(agg.avg),
    topEffects: [...tally]
      .map(([effect, n]) => ({ effect, count: n }))
      .sort((a, b) => b.count - a.count || a.effect.localeCompare(b.effect)),
  };
}

// --- want-to-try list -------------------------------------------------------

export async function listWishlist(db: Db): Promise<WishlistItem[]> {
  return db.select().from(wishlistItem).orderBy(desc(wishlistItem.addedAt));
}

export async function isWishlisted(db: Db, strainKey: string): Promise<boolean> {
  const [row] = await db
    .select({ k: wishlistItem.strainKey })
    .from(wishlistItem)
    .where(eq(wishlistItem.strainKey, strainKey))
    .limit(1);
  return !!row;
}

/** Idempotent: re-adding keeps the original row (and its added date). */
export async function addToWishlist(
  db: Db,
  strainKey: string,
  { source = "manual", note = null }: { source?: WishlistSource; note?: string | null } = {},
): Promise<void> {
  await db.insert(wishlistItem).values({ strainKey, source, note }).onConflictDoNothing();
}

export async function removeFromWishlist(db: Db, strainKey: string): Promise<void> {
  await db.delete(wishlistItem).where(eq(wishlistItem.strainKey, strainKey));
}

/** Which of `keys` have at least one visible entry (for "tried" markers). */
export async function triedKeys(db: Db, keys: string[], { includePrivate }: { includePrivate: boolean }) {
  if (!keys.length) return new Set<string>();
  const rows = await db
    .selectDistinct({ k: journalEntry.strainKey })
    .from(journalEntry)
    .where(and(inArray(journalEntry.strainKey, keys), visible(includePrivate)));
  return new Set(rows.map((r) => r.k));
}
