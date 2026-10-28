import Link from "next/link";

import { formatDay } from "@/app/lib/journal/format";
import type { JournalEntry } from "@/app/lib/journal/queries";
import { Chips } from "./Chips";
import { Stars } from "./Stars";

/**
 * One journal session. Server component: visibility filtering already happened
 * in the query; `isOwner` only adds the edit link and the private badge.
 */
export function EntryCard({
  entry,
  strainName,
  isOwner,
}: {
  entry: JournalEntry;
  /** When set, the card links to the strain (journal-wide lists). */
  strainName?: string;
  isOwner: boolean;
}) {
  const context = [
    entry.method,
    entry.timeOfDay,
    entry.dose,
    [entry.brand, entry.batch].filter(Boolean).join(" · ") || null,
  ].filter(Boolean);

  return (
    <article className="rounded-lg bg-zinc-900 p-4 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-3">
          {strainName && (
            <Link href={`/strain/${entry.strainKey}`} className="font-medium text-zinc-100 hover:underline">
              {strainName}
            </Link>
          )}
          <Stars halves={entry.ratingHalves} />
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {isOwner && !entry.isPublic && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">private</span>
          )}
          <time dateTime={entry.consumedOn}>{formatDay(entry.consumedOn)}</time>
          {isOwner && (
            <Link href={`/journal/${entry.id}/edit`} className="hover:text-zinc-200">
              Edit
            </Link>
          )}
        </div>
      </header>

      {context.length > 0 && <p className="mt-1 text-xs capitalize text-zinc-500">{context.join(" · ")}</p>}

      {entry.notes && (
        // Plain text only (whitespace preserved) — never rendered as HTML.
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-300">{entry.notes}</p>
      )}

      <div className="mt-2 space-y-1.5">
        <Chips items={entry.effectsFelt} />
        <Chips items={entry.negativesFelt} tone="warn" />
        <Chips items={[...entry.flavors, ...entry.terpenes]} />
      </div>

      {entry.wouldBuyAgain != null && (
        <p className="mt-2 text-xs text-zinc-500">{entry.wouldBuyAgain ? "Would buy again" : "Wouldn't buy again"}</p>
      )}
    </article>
  );
}
