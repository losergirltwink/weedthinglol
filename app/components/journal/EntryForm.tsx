"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEntryAction, deleteEntryAction, updateEntryAction } from "@/app/lib/journal/actions";
import {
  FLAVOR_SUGGESTIONS,
  METHODS,
  TERPENE_SUGGESTIONS,
  TIMES_OF_DAY,
  type Method,
  type TimeOfDay,
} from "@/app/lib/journal/constants";
import { localToday } from "@/app/lib/journal/format";
import type { EntryDraft, FieldErrors } from "@/app/lib/journal/input";
import { RatingInput } from "./RatingInput";
import { TagInput } from "./TagInput";

export interface EntryFormValues {
  ratingHalves: number;
  consumedOn: string;
  notes: string;
  effectsFelt: string[];
  negativesFelt: string[];
  flavors: string[];
  terpenes: string[];
  method: Method | "";
  timeOfDay: TimeOfDay | "";
  dose: string;
  brand: string;
  batch: string;
  wouldBuyAgain: "" | "yes" | "no";
  isPublic: boolean;
}

const blank = (): EntryFormValues => ({
  ratingHalves: 7,
  consumedOn: localToday(),
  notes: "",
  effectsFelt: [],
  negativesFelt: [],
  flavors: [],
  terpenes: [],
  method: "",
  timeOfDay: "",
  dose: "",
  brand: "",
  batch: "",
  wouldBuyAgain: "",
  isPublic: true,
});

const field =
  "w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

/** Create or edit a journal session for one strain. Owner-only pages render it. */
export function EntryForm({
  strain,
  vocabulary,
  entryId,
  initial,
}: {
  strain: { key: string; name: string };
  vocabulary: { effects: string[]; negatives: string[] };
  entryId?: string;
  initial?: EntryFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<EntryFormValues>(() => initial ?? blank());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof EntryFormValues>(k: K, val: EntryFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const draft: EntryDraft = {
      ...v,
      strainKey: strain.key,
      method: v.method || null,
      timeOfDay: v.timeOfDay || null,
      wouldBuyAgain: v.wouldBuyAgain === "" ? null : v.wouldBuyAgain === "yes",
    };
    startTransition(async () => {
      const res = entryId ? await updateEntryAction(entryId, draft) : await createEntryAction(draft);
      if (!res.ok) return setErrors(res.errors);
      router.push(`/strain/${strain.key}`);
      router.refresh();
    });
  }

  function remove() {
    if (!entryId || !confirm("Delete this session? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deleteEntryAction(entryId);
      if (!res.ok) return setErrors(res.errors);
      router.push(`/strain/${strain.key}`);
      router.refresh();
    });
  }

  const err = (k: keyof FieldErrors) =>
    errors[k] ? <p className="mt-1 text-xs text-amber-400">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <RatingInput value={v.ratingHalves} onChange={(n) => set("ratingHalves", n)} />
          {err("ratingHalves")}
        </div>
        <label className="block">
          <span className={labelCls}>Date</span>
          <input
            type="date"
            value={v.consumedOn}
            max={localToday()}
            onChange={(e) => set("consumedOn", e.target.value)}
            className={field}
            required
          />
          {err("consumedOn")}
        </label>
      </div>

      <TagInput
        label="Effects felt"
        value={v.effectsFelt}
        onChange={(t) => set("effectsFelt", t)}
        suggestions={vocabulary.effects}
      />
      <TagInput
        label="Side effects"
        value={v.negativesFelt}
        onChange={(t) => set("negativesFelt", t)}
        suggestions={vocabulary.negatives}
        tone="warn"
      />

      <label className="block">
        <span className={labelCls}>Notes</span>
        <textarea
          value={v.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="How was it?"
          className={field}
        />
        {err("notes")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Method</span>
          <select value={v.method} onChange={(e) => set("method", e.target.value as Method | "")} className={field}>
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m} value={m} className="capitalize">
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Time of day</span>
          <select
            value={v.timeOfDay}
            onChange={(e) => set("timeOfDay", e.target.value as TimeOfDay | "")}
            className={field}
          >
            <option value="">—</option>
            {TIMES_OF_DAY.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Dose</span>
          <input value={v.dose} onChange={(e) => set("dose", e.target.value)} maxLength={120} placeholder="e.g. 2 puffs, 5mg" className={field} />
        </label>
        <label className="block">
          <span className={labelCls}>Would buy again?</span>
          <select
            value={v.wouldBuyAgain}
            onChange={(e) => set("wouldBuyAgain", e.target.value as EntryFormValues["wouldBuyAgain"])}
            className={field}
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Brand</span>
          <input value={v.brand} onChange={(e) => set("brand", e.target.value)} maxLength={120} className={field} />
        </label>
        <label className="block">
          <span className={labelCls}>Batch</span>
          <input value={v.batch} onChange={(e) => set("batch", e.target.value)} maxLength={120} className={field} />
        </label>
      </div>

      <TagInput label="Flavors" value={v.flavors} onChange={(t) => set("flavors", t)} suggestions={FLAVOR_SUGGESTIONS} />
      <TagInput label="Terpenes" value={v.terpenes} onChange={(t) => set("terpenes", t)} suggestions={TERPENE_SUGGESTIONS} />

      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={v.isPublic}
          onChange={(e) => set("isPublic", e.target.checked)}
          className="mt-0.5 accent-zinc-200"
        />
        <span>
          Public
          <span className="block text-xs text-zinc-500">
            Visible to visitors (with the date, not the time). Uncheck to keep it to yourself.
          </span>
        </span>
      </label>

      {(errors.form || errors.strainKey) && (
        <p role="alert" className="text-sm text-amber-400">
          {errors.form ?? errors.strainKey}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? "Saving…" : entryId ? "Save changes" : "Log session"}
        </button>
        {entryId && (
          <button type="button" onClick={remove} disabled={pending} className="text-sm text-zinc-500 hover:text-red-400">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
