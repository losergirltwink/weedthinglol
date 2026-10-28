import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/app/components/PageShell";
import { DeletePersonalButton } from "@/app/components/queue/DeletePersonalButton";
import { catalogEntries } from "@/app/lib/catalog";
import { listWishlist, sessionCounts } from "@/app/lib/journal/queries";
import { requireOwnerPage } from "@/app/lib/owner";
import { listPersonalStrains } from "@/app/lib/personal/queries";
import { rankCandidates, shadowedPersonal } from "@/app/lib/promotion";
import { strainNames } from "@/app/lib/strain-resolver";
import { getDb } from "@/db";

export const metadata: Metadata = { title: "Promotion queue", robots: { index: false } };

// Owner-only. Promotion edits data/curated/ in the repo, so this page can't do
// it in production; it ranks candidates and hands you the command to run.
export default async function QueuePage() {
  await requireOwnerPage();
  const db = await getDb();
  const [personal, tried, wishlist] = await Promise.all([listPersonalStrains(db), sessionCounts(db), listWishlist(db)]);
  const catalog = catalogEntries();
  const candidates = rankCandidates({
    catalog,
    personal,
    tried,
    wishlist: new Set(wishlist.map((w) => w.strainKey)),
  });
  const shadowed = shadowedPersonal(catalog, personal);
  const names = await strainNames(db, candidates.flatMap((c) => c.uncuratedParents));

  return (
    <PageShell title="Promotion queue">
      <p className="max-w-xl text-sm text-zinc-400">
        Unverified strains worth checking and promoting into the curated data, ranked by your own use first.
        To promote one, run the command locally, verify the record and add citations, then{" "}
        <code className="text-zinc-300">pnpm build:graph</code> and commit.
      </p>

      {shadowed.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Promoted: clean up</h2>
          <ul className="mt-2 space-y-1">
            {shadowed.map((p) => (
              <li key={p.strainKey} className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2 text-sm">
                <Link href={`/strain/${p.strainKey}`} className="hover:underline">
                  {p.name}
                </Link>
                <DeletePersonalButton strainKey={p.strainKey} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        {candidates.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing queued yet. Log sessions or add to your want-to-try list.</p>
        ) : (
          <ol className="space-y-2">
            {candidates.map((c) => (
              <li key={c.key} className="rounded-lg bg-zinc-900 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/strain/${c.key}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <code className="select-all rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                    pnpm promote {c.key}
                  </code>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className={c.origin === "personal" ? "text-sky-400/80" : "text-red-400/80"}>{c.origin}</span>
                  {" · "}
                  {c.reasons.join(" · ")}
                </p>
                {c.uncuratedParents.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Promote parents first to keep their edges:{" "}
                    {c.uncuratedParents.map((p, i) => (
                      <span key={p}>
                        {i > 0 && ", "}
                        <Link href={`/strain/${p}`} className="text-zinc-400 hover:underline">
                          {names.get(p) ?? p}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageShell>
  );
}
