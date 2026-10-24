import type { Metadata } from "next";
import Link from "next/link";

import { Disclaimer } from "@/app/components/Disclaimer";
import { PageShell } from "@/app/components/PageShell";
import { AffinityBars, AffinityLegend, affinityRows, lineageRows } from "@/app/components/profile/AffinityBars";
import { RatingBars } from "@/app/components/profile/RatingBars";
import { listEntries } from "@/app/lib/journal/queries";
import { getViewer } from "@/app/lib/owner";
import { COLD_START_SESSIONS, computeProfile, type StrainStat } from "@/app/lib/profile";
import { profileLookup } from "@/app/lib/strain-resolver";
import { getDb } from "@/db";

export const metadata: Metadata = {
  title: "Taste profile",
  description: "What one person's strain ratings say about their taste.",
};

// Public: visitors get the profile computed from PUBLIC sessions only; the owner
// sees it computed from everything (and is told so).
export default async function ProfilePage() {
  const { isOwner } = await getViewer();
  const db = await getDb();
  const [entries, lookup] = await Promise.all([
    listEntries(db, { includePrivate: isOwner, limit: 100_000 }),
    profileLookup(db),
  ]);
  const p = computeProfile(entries, lookup);
  const privateCount = isOwner ? entries.filter((e) => !e.isPublic).length : 0;

  return (
    <PageShell title="Taste profile">
      <p className="text-sm text-zinc-400">
        {p.sessions === 0
          ? "No sessions logged yet."
          : `${p.sessions} session${p.sessions === 1 ? "" : "s"} across ${p.strainsTried} strain${
              p.strainsTried === 1 ? "" : "s"
            } · average ${p.meanRating!.toFixed(1)}★`}
        {privateCount > 0 && (
          <span className="text-zinc-500"> · includes {privateCount} private (visitors see public sessions only)</span>
        )}
      </p>
      <Disclaimer className="mt-2" />

      {p.coldStart ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
          Patterns need a few more data points. Log {COLD_START_SESSIONS - p.sessions} more session
          {COLD_START_SESSIONS - p.sessions === 1 ? "" : "s"} to unlock the profile.
          {isOwner && (
            <Link href="/journal/new" className="ml-2 text-zinc-300 underline decoration-zinc-600 hover:text-white">
              Log one
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <AffinityLegend />

          <Section title="Effects" empty="No effect pattern yet." show={p.effects.length > 0}>
            <AffinityBars rows={affinityRows(p.effects)} />
          </Section>

          <Section
            title="Lineage"
            hint="Ancestors of strains I rated: their influence fades by half each generation."
            empty="No family pattern yet (needs two rated strains sharing an ancestor)."
            show={p.lineage.length > 0}
          >
            <AffinityBars rows={lineageRows(p.lineage)} max={6} />
          </Section>

          <div className="grid gap-10 sm:grid-cols-2">
            <Section title="Strain type" empty="—" show={p.types.length > 0}>
              <RatingBars stats={p.types} />
            </Section>
            <Section title="Method" empty="No methods logged." show={p.methods.length > 0}>
              <RatingBars stats={p.methods} />
            </Section>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            <Section title="Flavors" empty="No flavor pattern yet." show={p.flavors.length > 0}>
              <AffinityBars rows={affinityRows(p.flavors)} max={6} />
            </Section>
            <Section title="Terpenes" empty="No terpene pattern yet." show={p.terpenes.length > 0}>
              <AffinityBars rows={affinityRows(p.terpenes)} max={6} />
            </Section>
          </div>

          <Section title="Side effects I report" empty="None reported." show={p.sideEffects.length > 0}>
            <ul className="space-y-1 text-sm">
              {p.sideEffects.map((s) => (
                <li key={s.tag} className="flex justify-between gap-4">
                  <span className="capitalize text-zinc-300">{s.tag}</span>
                  <span className="tabular-nums text-zinc-500">
                    {s.sessions} session{s.sessions === 1 ? "" : "s"} · {Math.round(s.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid gap-10 sm:grid-cols-2">
            <Section title="Favorites" empty="—" show={p.topStrains.length > 0}>
              <StrainList items={p.topStrains} />
            </Section>
            <Section title="Least favorite" empty="Need a few more strains." show={p.bottomStrains.length > 0}>
              <StrainList items={p.bottomStrains} />
            </Section>
          </div>

          {p.wouldBuyAgain.yes + p.wouldBuyAgain.no > 0 && (
            <p className="text-sm text-zinc-400">
              Would buy again: {p.wouldBuyAgain.yes} yes · {p.wouldBuyAgain.no} no
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Section({
  title,
  hint,
  empty,
  show,
  children,
}: {
  title: string;
  hint?: string;
  empty: string;
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-zinc-600">{hint}</p>}
      <div className="mt-3">{show ? children : <p className="text-sm text-zinc-600">{empty}</p>}</div>
    </section>
  );
}

function StrainList({ items }: { items: StrainStat[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {items.map((s) => (
        <li key={s.key} className="flex justify-between gap-4">
          <Link href={`/strain/${s.key}`} className="truncate text-zinc-300 hover:underline">
            {s.name}
          </Link>
          <span className="shrink-0 tabular-nums text-zinc-500">
            {s.avg.toFixed(1)}★{s.sessions > 1 ? ` · ${s.sessions}×` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

