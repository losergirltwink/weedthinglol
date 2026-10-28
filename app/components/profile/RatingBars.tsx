import type { GroupStat } from "@/app/lib/profile";
import { POSITIVE } from "./AffinityBars";

/** Average rating per group (0–5★), single-hue magnitude bars. */
export function RatingBars({ stats }: { stats: GroupStat[] }) {
  return (
    <ul className="space-y-1.5">
      {stats.map((s) => (
        <li
          key={s.group}
          title={`${s.group}: ${s.avg.toFixed(1)}★ average over ${s.sessions} session${s.sessions === 1 ? "" : "s"}`}
          className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm"
        >
          <span className="capitalize text-zinc-300">{s.group}</span>
          <span className="relative h-3 rounded-r bg-zinc-800" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(s.avg / 5) * 100}%`, backgroundColor: POSITIVE }} />
          </span>
          <span className="text-right text-xs tabular-nums text-zinc-400">
            {s.avg.toFixed(1)}★ · {s.sessions}
          </span>
        </li>
      ))}
    </ul>
  );
}
