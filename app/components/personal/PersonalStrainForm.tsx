"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createPersonalStrainAction,
  deletePersonalStrainAction,
  updatePersonalStrainAction,
} from "@/app/lib/personal/actions";
import type { PersonalFieldErrors } from "@/app/lib/personal/input";
import { normalizeName } from "@/app/lib/strain-key";
import { STRAIN_TYPES, type StrainType } from "@/app/lib/strains";

interface Option {
  key: string;
  name: string;
  confidence: string;
}

const MAX_PARENTS = 4;
const field =
  "w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

/** Add or edit a personal strain (one the graph doesn't have). */
export function PersonalStrainForm({
  options,
  existing,
  initialName = "",
}: {
  options: Option[];
  /** Present when editing. */
  existing?: { key: string; name: string; strainType: StrainType; parentKeys: string[]; notes: string | null };
  initialName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? initialName);
  const [strainType, setStrainType] = useState<StrainType>(existing?.strainType ?? "hybrid");
  const [parents, setParents] = useState<string[]>(existing?.parentKeys ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState<PersonalFieldErrors>({});
  const [pending, startTransition] = useTransition();

  const nameOf = useMemo(() => new Map(options.map((o) => [o.key, o.name])), [options]);
  const matches = useMemo(() => {
    const needle = normalizeName(q);
    if (!needle) return [];
    return options
      .filter((o) => o.key !== existing?.key && !parents.includes(o.key))
      .filter((o) => normalizeName(o.name).includes(needle))
      .slice(0, 8);
  }, [q, options, parents, existing?.key]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const draft = { name, strainType, parentKeys: parents, notes };
    startTransition(async () => {
      const res = existing
        ? await updatePersonalStrainAction(existing.key, draft)
        : await createPersonalStrainAction(draft);
      if (!res.ok) return setErrors(res.errors);
      // New strain → straight into logging it; edits → back to its page.
      router.push(existing ? `/strain/${res.key}` : `/journal/new?strain=${encodeURIComponent(res.key)}`);
      router.refresh();
    });
  }

  function remove() {
    if (!existing || !confirm(`Delete ${existing.name}?`)) return;
    startTransition(async () => {
      const res = await deletePersonalStrainAction(existing.key);
      if (!res.ok) return setErrors(res.errors);
      router.push("/journal");
      router.refresh();
    });
  }

  const err = (k: keyof PersonalFieldErrors) =>
    errors[k] ? <p className="mt-1 text-xs text-amber-400">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} />
          {err("name")}
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select value={strainType} onChange={(e) => setStrainType(e.target.value as StrainType)} className={`${field} capitalize`}>
            {STRAIN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className={labelCls}>Parents (optional, if known)</legend>
        <div className="flex flex-wrap gap-1.5">
          {parents.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setParents(parents.filter((p) => p !== k))}
              className="rounded-md bg-zinc-700 px-2 py-0.5 text-xs text-zinc-100 hover:bg-zinc-600"
              aria-label={`Remove parent ${nameOf.get(k) ?? k}`}
            >
              {nameOf.get(k) ?? k} ✕
            </button>
          ))}
        </div>
        {parents.length < MAX_PARENTS && (
          <div className="mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a parent…"
              aria-label="Search for a parent strain"
              className={field}
            />
            {matches.length > 0 && (
              <ul className="mt-1 divide-y divide-zinc-800 rounded-md bg-zinc-900">
                {matches.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setParents([...parents, o.key]);
                        setQ("");
                      }}
                      className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-zinc-800"
                    >
                      <span>{o.name}</span>
                      {o.confidence !== "curated" && <span className="text-xs text-zinc-500">{o.confidence}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {err("parentKeys")}
      </fieldset>

      <label className="block">
        <span className={labelCls}>Private notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Where you found it, breeder, what the budtender said… (only you see this)"
          className={field}
        />
        {err("notes")}
      </label>

      {errors.form && (
        <p role="alert" className="text-sm text-amber-400">
          {errors.form}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Save changes" : "Add strain & log a session"}
        </button>
        {existing && (
          <button type="button" onClick={remove} disabled={pending} className="text-sm text-zinc-500 hover:text-red-400">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
