// Validation + normalization for journal writes. Every server action parses its
// input through here — never trust the client's shape, lengths, or tags.

import { z } from "zod";

import { isNegativeEffect } from "../strains";
import { LIMITS, METHODS, TIMES_OF_DAY } from "./constants";
import { normalizeTag } from "./format";

const tags = z
  .array(z.string().max(200))
  .max(LIMITS.tags * 2)
  .default([])
  .transform((list) => [...new Set(list.map(normalizeTag).filter(Boolean))])
  .pipe(z.array(z.string().max(LIMITS.tag)).max(LIMITS.tags));

/** Optional free text: trimmed, empty → null. */
const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .pipe(z.string().max(max).nullable());

const isoDate = z.iso.date();

export const entryInput = z
  .object({
    strainKey: z.string().trim().min(1).max(200),
    ratingHalves: z.number().int().min(1).max(10),
    consumedOn: isoDate,
    notes: optionalText(LIMITS.notes),
    effectsFelt: tags,
    negativesFelt: tags,
    flavors: tags,
    terpenes: tags,
    method: z.enum(METHODS).nullish().transform((v) => v ?? null),
    timeOfDay: z.enum(TIMES_OF_DAY).nullish().transform((v) => v ?? null),
    dose: optionalText(LIMITS.shortText),
    brand: optionalText(LIMITS.shortText),
    batch: optionalText(LIMITS.shortText),
    wouldBuyAgain: z.boolean().nullish().transform((v) => v ?? null),
    isPublic: z.boolean().default(true),
  })
  .refine((e) => e.consumedOn <= tomorrow(), {
    path: ["consumedOn"],
    message: "Date can't be in the future",
  })
  // Side-effects tagged as "effects" are moved to negatives, keeping the same
  // desirable/negative partition as the strain data (NEGATIVE_EFFECTS).
  .transform((e) => {
    const moved = e.effectsFelt.filter(isNegativeEffect);
    return {
      ...e,
      effectsFelt: e.effectsFelt.filter((x) => !isNegativeEffect(x)),
      negativesFelt: [...new Set([...e.negativesFelt, ...moved])],
    };
  });

export type EntryInput = z.output<typeof entryInput>;
export type EntryDraft = z.input<typeof entryInput>;

// One day of slack so a late-evening entry in any timezone isn't rejected.
function tomorrow(): string {
  return new Date(Date.now() + 864e5).toISOString().slice(0, 10);
}

export type FieldErrors = Partial<Record<keyof EntryDraft | "form", string>>;

/** Parse untrusted input; on failure return the first message per field. */
export function parseEntry(
  raw: unknown,
): { ok: true; data: EntryInput } | { ok: false; errors: FieldErrors } {
  const r = entryInput.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = (issue.path[0] as keyof FieldErrors | undefined) ?? "form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

export const wishlistNote = optionalText(LIMITS.shortText * 2);
