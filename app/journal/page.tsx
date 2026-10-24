import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/app/components/PageShell";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import { EntryCard } from "@/app/components/journal/EntryCard";
import { listEntries, listWishlist } from "@/app/lib/journal/queries";
import { getViewer } from "@/app/lib/owner";
import { strainNames } from "@/app/lib/strain-resolver";
import { getDb } from "@/db";

export const metadata: Metadata = {
  title: "Journal",
  description: "A personal log of strains tried, with ratings and notes.",
};

// Public, read-only for visitors (public sessions only); the owner sees
// everything plus write controls.
export default async function JournalPage() {
  const { isOwner } = await getViewer();
  const db = await getDb();
  const [entries, wishlist] = await Promise.all([
    listEntries(db, { includePrivate: isOwner }),
    listWishlist(db),
  ]);
  const names = await strainNames(db, [...entries.map((e) => e.strainKey), ...wishlist.map((w) => w.strainKey)]);
  const strainName = (k: string) => names.get(k) ?? k;

  return (
    <PageShell
      title="Journal"
      actions={
        isOwner ? (
          <>
            <Link href="/queue" className="text-zinc-400 hover:text-zinc-100">
              Queue
            </Link>
            <Link href="/account" className="text-zinc-400 hover:text-zinc-100">
              Account
            </Link>
            <SignOutButton />
          </>
        ) : null
      }
    >
      {isOwner && (
        <Link
          href="/journal/new"
          className="inline-block rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Log a session
        </Link>
      )}

      <div className="mt-6 space-y-3">
        {entries.length ? (
          entries.map((e) => (
            <EntryCard key={e.id} entry={e} strainName={strainName(e.strainKey)} isOwner={isOwner} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            No sessions logged yet.
          </div>
        )}
      </div>

      {wishlist.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Want to try</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {wishlist.map((w) => (
              <li key={w.strainKey}>
                <Link
                  href={`/strain/${w.strainKey}`}
                  className="rounded-md bg-zinc-800 px-2 py-0.5 text-sm text-zinc-200 hover:bg-zinc-700"
                  title={w.note ?? undefined}
                >
                  {strainName(w.strainKey)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
