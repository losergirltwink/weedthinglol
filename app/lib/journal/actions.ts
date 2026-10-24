"use server";

// Journal mutations. Server actions are public HTTP endpoints, so EVERY export
// here starts with `await requireOwner()` (enforced by actions.test.ts), then
// validates its input — arguments are untrusted even from our own forms.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { hasStrain } from "../catalog";
import { requireOwner } from "../owner";
import { parseEntry, wishlistNote, type FieldErrors } from "./input";
import {
  addToWishlist,
  createEntry,
  deleteEntry,
  removeFromWishlist,
  updateEntry,
} from "./queries";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

const entryId = z.uuid();
const strainKeyArg = z.string().trim().min(1).max(200);

function revalidateStrain(strainKey: string) {
  revalidatePath("/journal");
  revalidatePath(`/strain/${strainKey}`);
}

export async function createEntryAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = parseEntry(raw);
  if (!parsed.ok) return parsed;
  if (!hasStrain(parsed.data.strainKey)) return { ok: false, errors: { strainKey: "Unknown strain" } };
  const row = await createEntry(await getDb(), parsed.data);
  revalidateStrain(row.strainKey);
  return { ok: true, data: { id: row.id } };
}

export async function updateEntryAction(id: unknown, raw: unknown): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const idParsed = entryId.safeParse(id);
  if (!idParsed.success) return { ok: false, errors: { form: "Invalid entry id" } };
  const parsed = parseEntry(raw);
  if (!parsed.ok) return parsed;
  if (!hasStrain(parsed.data.strainKey)) return { ok: false, errors: { strainKey: "Unknown strain" } };
  const row = await updateEntry(await getDb(), idParsed.data, parsed.data);
  if (!row) return { ok: false, errors: { form: "Entry not found" } };
  revalidateStrain(row.strainKey);
  return { ok: true, data: { id: row.id } };
}

export async function deleteEntryAction(id: unknown): Promise<ActionResult> {
  await requireOwner();
  const idParsed = entryId.safeParse(id);
  if (!idParsed.success) return { ok: false, errors: { form: "Invalid entry id" } };
  const row = await deleteEntry(await getDb(), idParsed.data);
  if (!row) return { ok: false, errors: { form: "Entry not found" } };
  revalidateStrain(row.strainKey);
  return { ok: true, data: undefined };
}

export async function setWishlistedAction(
  strainKey: unknown,
  wishlisted: unknown,
  note?: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const key = strainKeyArg.safeParse(strainKey);
  const want = z.boolean().safeParse(wishlisted);
  const noteParsed = wishlistNote.safeParse(note);
  if (!key.success || !want.success || !noteParsed.success || !hasStrain(key.data)) {
    return { ok: false, errors: { form: "Invalid request" } };
  }
  const db = await getDb();
  if (want.data) await addToWishlist(db, key.data, { source: "manual", note: noteParsed.data });
  else await removeFromWishlist(db, key.data);
  revalidateStrain(key.data);
  return { ok: true, data: undefined };
}
