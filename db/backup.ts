// Portable backup of my personal data (journal sessions, want-to-try list,
// personal strains) as versioned JSON — independent of the hosting provider.
// Auth tables are deliberately excluded: they're recreated by signing in, and a
// dump of session tokens would be a liability.

import { z } from "zod";

import { STRAIN_TYPES } from "@/app/lib/strains";
import { METHODS, TIMES_OF_DAY, WISHLIST_SOURCES } from "@/app/lib/journal/constants";
import type { Db } from "./client";
import { journalEntry, personalStrain, wishlistItem } from "./schema";

const ts = z.coerce.date();

const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  journalEntries: z.array(
    z.object({
      id: z.uuid(),
      strainKey: z.string(),
      ratingHalves: z.number().int().min(1).max(10),
      notes: z.string().nullable(),
      effectsFelt: z.array(z.string()),
      negativesFelt: z.array(z.string()),
      flavors: z.array(z.string()),
      terpenes: z.array(z.string()),
      method: z.enum(METHODS).nullable(),
      dose: z.string().nullable(),
      timeOfDay: z.enum(TIMES_OF_DAY).nullable(),
      brand: z.string().nullable(),
      batch: z.string().nullable(),
      wouldBuyAgain: z.boolean().nullable(),
      consumedOn: z.iso.date(),
      isPublic: z.boolean(),
      createdAt: ts,
      updatedAt: ts,
    }),
  ),
  wishlistItems: z.array(
    z.object({ strainKey: z.string(), source: z.enum(WISHLIST_SOURCES), note: z.string().nullable(), addedAt: ts }),
  ),
  personalStrains: z.array(
    z.object({
      strainKey: z.string(),
      name: z.string(),
      strainType: z.enum(STRAIN_TYPES),
      parentKeys: z.array(z.string()),
      notes: z.string().nullable(),
      createdAt: ts,
      updatedAt: ts,
    }),
  ),
});

export type JournalBackup = z.output<typeof backupSchema>;

export async function exportJournal(db: Db): Promise<JournalBackup> {
  const [journalEntries, wishlistItems, personalStrains] = await Promise.all([
    db.select().from(journalEntry).orderBy(journalEntry.createdAt),
    db.select().from(wishlistItem).orderBy(wishlistItem.addedAt),
    db.select().from(personalStrain).orderBy(personalStrain.createdAt),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), journalEntries, wishlistItems, personalStrains };
}

/**
 * Restore a backup (validated first). Refuses to touch a database that already
 * has personal data unless `replace`, which wipes those tables first. All or
 * nothing: runs in one transaction.
 */
export async function importJournal(
  db: Db,
  raw: unknown,
  { replace = false }: { replace?: boolean } = {},
): Promise<{ journalEntries: number; wishlistItems: number; personalStrains: number }> {
  const data = backupSchema.parse(raw);
  await db.transaction(async (tx) => {
    const existing =
      (await tx.select({ id: journalEntry.id }).from(journalEntry).limit(1)).length +
      (await tx.select({ k: wishlistItem.strainKey }).from(wishlistItem).limit(1)).length +
      (await tx.select({ k: personalStrain.strainKey }).from(personalStrain).limit(1)).length;
    if (existing && !replace) throw new Error("Target already has personal data; pass --replace to overwrite it.");
    if (replace) {
      await tx.delete(journalEntry);
      await tx.delete(wishlistItem);
      await tx.delete(personalStrain);
    }
    if (data.personalStrains.length) await tx.insert(personalStrain).values(data.personalStrains);
    if (data.journalEntries.length) await tx.insert(journalEntry).values(data.journalEntries);
    if (data.wishlistItems.length) await tx.insert(wishlistItem).values(data.wishlistItems);
  });
  return {
    journalEntries: data.journalEntries.length,
    wishlistItems: data.wishlistItems.length,
    personalStrains: data.personalStrains.length,
  };
}
