"use client";

import { useId, useState } from "react";

import { normalizeTag } from "@/app/lib/journal/format";

/**
 * Tag chips with suggestions + free entry. Enter or comma adds; clicking a chip
 * removes it. Suggestions not yet chosen show as quick-add buttons.
 */
export function TagInput({
  label,
  value,
  onChange,
  suggestions,
  tone = "plain",
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  tone?: "plain" | "warn";
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const chosen = new Set(value);

  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !chosen.has(t) && value.length < max) onChange([...value, t]);
    setDraft("");
  };

  const chip =
    tone === "warn"
      ? "border border-amber-900/60 text-amber-500/90 hover:border-amber-700"
      : "bg-zinc-700 text-zinc-100 hover:bg-zinc-600";

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className={`rounded-full px-2 py-0.5 text-xs capitalize ${chip}`}
            aria-label={`Remove ${t}`}
          >
            {t} ✕
          </button>
        ))}
        <input
          value={draft}
          list={listId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder="Add…"
          aria-label={`Add ${label.toLowerCase()}`}
          maxLength={40}
          className="min-w-24 flex-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id={listId}>
          {suggestions.filter((s) => !chosen.has(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {suggestions
          .filter((s) => !chosen.has(s))
          .slice(0, 12)
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full px-2 py-0.5 text-xs capitalize text-zinc-500 ring-1 ring-zinc-800 hover:text-zinc-200"
            >
              + {s}
            </button>
          ))}
      </div>
    </fieldset>
  );
}
