import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/app/components/PageShell";
import { Chips } from "@/app/components/journal/Chips";
import { EntryCard } from "@/app/components/journal/EntryCard";
import { Stars } from "@/app/components/journal/Stars";
import { WishlistButton } from "@/app/components/journal/WishlistButton";
import { isWishlisted, listEntries, strainSummary } from "@/app/lib/journal/queries";
import { getViewer } from "@/app/lib/owner";
import { resolveStrain, strainNames } from "@/app/lib/strain-resolver";
import { CONFIDENCE_META, TYPE_COLORS } from "@/app/lib/strains";
import { sourceById } from "@/data/sources";
import { getDb } from "@/db";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const strain = await resolveStrain(await getDb(), (await params).key);
  if (!strain) return {};
  return {
    title: strain.name,
    description: `${strain.name}: lineage, effects, and personal notes.`,
    // Index verified + personal strains; crowd entries stay findable on-site but
    // out of search results.
    robots: strain.confidence === "crowd" ? { index: false } : undefined,
  };
}

export default async function StrainPage({ params }: Params) {
  const { key } = await params;
  const db = await getDb();
  const strain = await resolveStrain(db, key);
  if (!strain) notFound();

  const { isOwner } = await getViewer();
  const visibility = { includePrivate: isOwner };
  const [summary, entries, wishlisted, names] = await Promise.all([
    strainSummary(db, key, visibility),
    listEntries(db, { ...visibility, strainKey: key }),
    isOwner ? isWishlisted(db, key) : Promise.resolve(false),
    strainNames(db, [...strain.parents, ...strain.children]),
  ]);
  const isPersonal = strain.confidence === "personal";

  const meta = CONFIDENCE_META[strain.confidence];
  const source = sourceById(strain.source);

  return (
    <PageShell title={strain.name}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[strain.strainType] }} />
        <span className="capitalize">{strain.strainType}</span>
        <span className="text-zinc-600">·</span>
        <span>gen {strain.generation}</span>
        <span className="text-zinc-600">·</span>
        <span>{strain.descendants} descendants</span>
        {strain.confidence !== "curated" && (
          <span
            className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
          >
            {meta.label}
          </span>
        )}
      </div>
      {strain.confidence !== "curated" && source && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{source.attribution}</p>
      )}
      {isPersonal && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Added from the journal: not in the graph data, parentage unverified.
          {isOwner && (
            <Link href={`/strains/${key}/edit`} className="ml-2 text-zinc-400 hover:text-zinc-200">
              Edit
            </Link>
          )}
        </p>
      )}

      <section className="mt-6 space-y-2">
        <Chips items={strain.effects} />
        {strain.negatives.length > 0 && <Chips items={strain.negatives} tone="warn" />}
        {strain.note && <p className="text-sm italic text-zinc-500">{strain.note}</p>}
        {/* Personal-strain notes (where found, budtender, …) can reveal location:
            owner-only, unlike journal sessions which have their own public flag. */}
        {isOwner && strain.personalNotes && (
          <p className="whitespace-pre-wrap text-sm text-zinc-400">{strain.personalNotes}</p>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Lineage
          title="Parents"
          keys={strain.parents}
          names={names}
          empty={isPersonal ? "Unknown" : "Landrace / root"}
          badge={strain.lineageStatus}
        />
        <Lineage title="Children" keys={strain.children} names={names} empty="None recorded" />
      </section>

      {strain.citations?.length ? (
        <section className="mt-6">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Sources</h2>
          <ul className="space-y-0.5 text-sm">
            {strain.citations.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200">
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Journal</h2>
          {isOwner && (
            <div className="flex gap-2">
              <WishlistButton strainKey={key} wishlisted={wishlisted} />
              <Link
                href={`/journal/new?strain=${encodeURIComponent(key)}`}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Log a session
              </Link>
            </div>
          )}
        </div>
        {summary.sessions > 0 && summary.avgHalves != null && (
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <Stars halves={Math.round(summary.avgHalves)} />
            <span>
              avg {(summary.avgHalves / 2).toFixed(1)} over {summary.sessions} session
              {summary.sessions === 1 ? "" : "s"}
            </span>
          </p>
        )}
        <div className="mt-4 space-y-3">
          {entries.length ? (
            entries.map((e) => <EntryCard key={e.id} entry={e} isOwner={isOwner} />)
          ) : (
            <p className="text-sm text-zinc-500">Not tried yet.</p>
          )}
        </div>
      </section>
    </PageShell>
  );
}

const STATUS_LABEL = { confirmed: "confirmed", reported: "reported", disputed: "disputed" } as const;

function Lineage({
  title,
  keys,
  names,
  empty,
  badge,
}: {
  title: string;
  keys: string[];
  names: Map<string, string>;
  empty: string;
  badge?: keyof typeof STATUS_LABEL;
}) {
  return (
    <div>
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
        {badge && <span className="ml-2 normal-case tracking-normal text-zinc-500">· {STATUS_LABEL[badge]}</span>}
      </h2>
      {keys.length ? (
        <div className="flex flex-wrap gap-1.5">
          {keys.map((k) => (
            <Link key={k} href={`/strain/${k}`} className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-700">
              {names.get(k) ?? k}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">{empty}</p>
      )}
    </div>
  );
}
