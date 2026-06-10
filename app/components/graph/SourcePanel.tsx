"use client";

import type { SourceOption } from "@/data/sources";

interface Props {
  sources: readonly SourceOption[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Data-source selector. Switches which baked graph the explorer loads — the
 * source axis, sibling to the 2D/3D renderer axis. Hidden when only one source
 * exists (a dropdown of one is noise).
 */
export function SourcePanel({ sources, value, onChange }: Props) {
  if (sources.length <= 1) return null;

  return (
    <div className="rounded-lg bg-zinc-900/85 p-2 text-sm shadow-lg backdrop-blur">
      <label className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Data source
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      >
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
