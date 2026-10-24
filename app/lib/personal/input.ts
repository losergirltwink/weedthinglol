// Validation for personal-strain writes. The strainKey is derived from the name
// on create and is immutable afterwards (journal entries reference it).

import { z } from "zod";

import { strainKey } from "../strain-key";
import { STRAIN_TYPES } from "../strains";

export const MAX_PARENTS = 4;

export const personalStrainInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80)
    .refine((n) => strainKey(n).length > 0, "Name needs at least one letter or digit"),
  strainType: z.enum(STRAIN_TYPES),
  parentKeys: z
    .array(z.string().trim().min(1).max(200))
    .max(MAX_PARENTS, `At most ${MAX_PARENTS} parents`)
    .default([])
    .transform((keys) => [...new Set(keys)]),
  notes: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .pipe(z.string().max(2000).nullable()),
});

export type PersonalStrainInput = z.output<typeof personalStrainInput>;
export type PersonalStrainDraft = z.input<typeof personalStrainInput>;

export type PersonalFieldErrors = Partial<Record<keyof PersonalStrainDraft | "form", string>>;

export function parsePersonalStrain(
  raw: unknown,
): { ok: true; data: PersonalStrainInput } | { ok: false; errors: PersonalFieldErrors } {
  const r = personalStrainInput.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const errors: PersonalFieldErrors = {};
  for (const issue of r.error.issues) {
    const key = (issue.path[0] as keyof PersonalFieldErrors | undefined) ?? "form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
