import Link from "next/link";

import type { Affinity, LineageAffinity } from "@/app/lib/profile";

// Diverging encoding (dataviz skill, validated vs the zinc-900 card surface):
// blue = above my average, red = below, gray midline = neutral. Bar direction
// and the signed value carry the sign too, so color is never the only channel.
export const POSITIVE = "#3987e5";
export const NEGATIVE = "#e66767";
const MIDLINE = "#383835";
const EPS_SCALE = 1e-9;

type Row = { label: string; score: number; detail: string; href?: string };

const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`;

export function affinityRows(items: Affinity[]): Row[] {
  return items.map((a) => ({
    label: a.tag,
    score: a.score,
    detail: `${signed(a.score)}★ vs your average across ${a.sessions} session${a.sessions === 1 ? "" : "s"}`,
  }));
}

export function lineageRows(items: LineageAffinity[]): Row[] {
  return items.map((l) => ({
    label: l.name,
    score: l.score,
    detail: `via ${l.via.join(", ")}`,
    href: `/strain/${l.key}`,
  }));
}

/** Diverging horizontal bars around a center line, scaled to the largest |score|. */
export function AffinityBars({ rows, max = 8 }: { rows: Row[]; max?: number }) {
  const shown = rows.slice(0, max);
  const scale = Math.max(...shown.map((r) => Math.abs(r.score)), EPS_SCALE);
  return (
    <ul className="space-y-1.5">
      {shown.map((r) => {
        const pct = (Math.abs(r.score) / scale) * 50;
        const positive = r.score > 0;
        return (
          // Native title = the hover tooltip; the visible label + value make the
          // list readable as a table without hovering.
          <li key={r.label} title={`${r.label}: ${r.detail}`} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate capitalize text-zinc-300">
              {r.href ? (
                <Link href={r.href} className="hover:underline">
                  {r.label}
                </Link>
              ) : (
                r.label
              )}
            </span>
            <span className="relative h-3" aria-hidden>
              <span className="absolute inset-y-[-2px] left-1/2 w-px" style={{ backgroundColor: MIDLINE }} />
              <span
                className={`absolute inset-y-0 ${positive ? "left-1/2 rounded-r" : "right-1/2 rounded-l"}`}
                style={{ width: `${pct}%`, backgroundColor: positive ? POSITIVE : NEGATIVE }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-zinc-400">{signed(r.score)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Shared key for every diverging chart on the page. */
export function AffinityLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NEGATIVE }} />
        rated below my average
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: POSITIVE }} />
        rated above my average
      </span>
      <span>Values are stars relative to my average session.</span>
    </p>
  );
}
