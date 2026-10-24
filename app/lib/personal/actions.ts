"use server";

// Personal-strain mutations. Like every actions.ts: each export starts with
// `await requireOwner()` (enforced by app/lib/actions.test.ts), then validates.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { hasStrain } from "../catalog";
import { requireOwner } from "../owner";
import { strainKey } from "../strain-key";
import { strainExists } from "../strain-resolver";
import { parsePersonalStrain, type PersonalFieldErrors, type PersonalStrainInput } from "./input";
import {
  createPersonalStrain,
  deletePersonalStrain,
  getPersonalStrain,
  personalStrainUsage,
  updatePersonalStrain,
  wouldCreateCycle,
} from "./queries";
import type { Db } from "@/db/client";

export type PersonalResult = { ok: true; key: string } | { ok: false; errors: PersonalFieldErrors };

const keyArg = z.string().trim().min(1).max(200);

async function checkParents(db: Db, key: string, input: PersonalStrainInput): Promise<PersonalFieldErrors | null> {
  if (input.parentKeys.includes(key)) return { parentKeys: "A strain can't be its own parent" };
  for (const p of input.parentKeys) {
    if (!(await strainExists(db, p))) return { parentKeys: `Unknown parent: ${p}` };
  }
  if (await wouldCreateCycle(db, key, input.parentKeys)) {
    return { parentKeys: "Those parents would make this strain its own ancestor" };
  }
  return null;
}

function revalidateStrain(key: string, parents: string[] = []) {
  revalidatePath(`/strain/${key}`);
  for (const p of parents) revalidatePath(`/strain/${p}`);
  revalidatePath("/queue");
}

export async function createPersonalStrainAction(raw: unknown): Promise<PersonalResult> {
  await requireOwner();
  const parsed = parsePersonalStrain(raw);
  if (!parsed.ok) return parsed;
  const key = strainKey(parsed.data.name);
  const db = await getDb();
  if (hasStrain(key)) return { ok: false, errors: { name: `Already in the graph — use /strain/${key}` } };
  if (await getPersonalStrain(db, key)) return { ok: false, errors: { name: "You already added this strain" } };
  const parentError = await checkParents(db, key, parsed.data);
  if (parentError) return { ok: false, errors: parentError };
  await createPersonalStrain(db, key, parsed.data);
  revalidateStrain(key, parsed.data.parentKeys);
  return { ok: true, key };
}

export async function updatePersonalStrainAction(key: unknown, raw: unknown): Promise<PersonalResult> {
  await requireOwner();
  const k = keyArg.safeParse(key);
  if (!k.success) return { ok: false, errors: { form: "Invalid strain" } };
  const parsed = parsePersonalStrain(raw);
  if (!parsed.ok) return parsed;
  // The key is identity (journal entries point at it): only cosmetic renames
  // that keep the same key are allowed.
  if (strainKey(parsed.data.name) !== k.data) {
    return { ok: false, errors: { name: "Renaming can only change spelling/capitalization, not the strain" } };
  }
  const db = await getDb();
  const before = await getPersonalStrain(db, k.data);
  if (!before) return { ok: false, errors: { form: "Strain not found" } };
  const parentError = await checkParents(db, k.data, parsed.data);
  if (parentError) return { ok: false, errors: parentError };
  await updatePersonalStrain(db, k.data, parsed.data);
  revalidateStrain(k.data, [...before.parentKeys, ...parsed.data.parentKeys]);
  return { ok: true, key: k.data };
}

export async function deletePersonalStrainAction(key: unknown): Promise<PersonalResult> {
  await requireOwner();
  const k = keyArg.safeParse(key);
  if (!k.success) return { ok: false, errors: { form: "Invalid strain" } };
  const db = await getDb();
  const before = await getPersonalStrain(db, k.data);
  if (!before) return { ok: false, errors: { form: "Strain not found" } };
  // Once promoted (the key now resolves to the catalog), the personal row is a
  // stale shadow and references stay valid without it.
  if (!hasStrain(k.data)) {
    const usage = await personalStrainUsage(db, k.data);
    if (usage.entries || usage.wishlisted || usage.children.length) {
      return {
        ok: false,
        errors: {
          form:
            "Still in use: " +
            [
              usage.entries && `${usage.entries} journal session(s)`,
              usage.wishlisted && "want-to-try list",
              usage.children.length && `parent of ${usage.children.join(", ")}`,
            ]
              .filter(Boolean)
              .join("; "),
        },
      };
    }
  }
  await deletePersonalStrain(db, k.data);
  revalidateStrain(k.data, before.parentKeys);
  return { ok: true, key: k.data };
}
