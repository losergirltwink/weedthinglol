"use client";

import { ratingValue, stars } from "@/app/lib/journal/format";

/** Half-star rating picker (a styled range input — keyboard accessible). */
export function RatingInput({ value, onChange }: { value: number; onChange: (halves: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Rating</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${ratingValue(value)} out of 5 stars`}
          className="w-48 accent-amber-400"
        />
        <span className="text-lg tracking-wider text-amber-400" aria-hidden>
          {stars(value)}
        </span>
        <span className="text-sm text-zinc-400">{ratingValue(value)}</span>
      </div>
    </label>
  );
}
