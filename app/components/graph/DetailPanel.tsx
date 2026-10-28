"use client";

import Link from "next/link";

import {
  CONFIDENCE_META,
  TYPE_COLORS,
  type Citation,
  type Confidence,
  type LineageStatus,
  type StrainType,
} from "@/app/lib/strains";
import { sourceById } from "@/data/sources";
import { Stars } from "@/app/components/journal/Stars";
import type { StrainGraphType } from "@/app/lib/graph-utils";

interface Props {
  graph: StrainGraphType;
  id: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** My rating summary for this strain, if I've logged it. */
  myRating?: { avgHalves: number; sessions: number };
  wishlisted?: boolean;
}

export function DetailPanel({ graph, id, onSelect, onClose, myRating, wishlisted = false }: Props) {
  const attrs = graph.getNodeAttributes(id);
  const parents = graph
    .inNeighbors(id)
    .map((p) => ({ id: p, label: graph.getNodeAttribute(p, "label") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const children = graph
    .outNeighbors(id)
    .map((c) => ({ id: c, label: graph.getNodeAttribute(c, "label") }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const color = TYPE_COLORS[attrs.strainType as StrainType];

  // Provenance badge: only surfaced for non-curated nodes, where it flags
  // less-verified data (e.g. a Leafly scrape). Curated nodes show nothing.
  const confidence = attrs.confidence as Confidence;
  const showProvenance = confidence !== "curated";
  const meta = CONFIDENCE_META[confidence];
  const sourceDef = sourceById(attrs.source);
  const lineageStatus = attrs.lineageStatus as LineageStatus | undefined;
  const citations = (attrs.citations ?? []) as Citation[];

  return (
    <div className="rounded-lg bg-zinc-900/90 p-4 text-sm shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">{attrs.label}</h2>
          <Link href={`/strain/${attrs.strainKey}`} className="text-xs text-zinc-500 hover:text-zinc-200">
            Strain page & journal →
          </Link>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ✕
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2 text-zinc-400">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="capitalize">{attrs.strainType}</span>
        <span className="text-zinc-600">·</span>
        <span>gen {attrs.generation}</span>
        <span className="text-zinc-600">·</span>
        <span>{attrs.descendants} descendants</span>
        {attrs.nameKind === "cross" && (
          <>
            <span className="text-zinc-600">·</span>
            <span
              className="text-zinc-500"
              title="Cross-expression: this node's name is a cross of two strains already in the graph, rather than a named cultivar."
            >
              cross
            </span>
          </>
        )}
      </div>

      {showProvenance && meta && (
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            title={`${meta.label} — ${meta.blurb}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
            {sourceDef && <span className="opacity-70">· {sourceDef.label}</span>}
          </span>
          {sourceDef && (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{sourceDef.attribution}</p>
          )}
        </div>
      )}

      {(myRating || wishlisted) && (
        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          {myRating ? (
            <>
              <Stars halves={Math.round(myRating.avgHalves)} />
              <span>
                my avg {(myRating.avgHalves / 2).toFixed(1)} · {myRating.sessions} session
                {myRating.sessions === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="text-emerald-400/90">On my want-to-try list</span>
          )}
        </p>
      )}

      {attrs.effects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {attrs.effects.map((e) => (
            <span
              key={e}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-300"
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {(attrs.negatives ?? []).length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-600/80">
            May cause
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attrs.negatives.map((e) => (
              <span
                key={e}
                className="rounded-full border border-amber-900/60 px-2 py-0.5 text-xs capitalize text-amber-500/90"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {attrs.note && (
        <p className="mt-3 text-xs italic leading-relaxed text-zinc-500">{attrs.note}</p>
      )}

      <ChipList
        title="Parents"
        badge={lineageStatus && LINEAGE_STATUS_META[lineageStatus]}
        items={parents}
        onSelect={onSelect}
        empty="Landrace / root"
      />
      <ChipList title="Children" items={children} onSelect={onSelect} empty="None recorded" />

      {citations.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Sources</p>
          <ul className="space-y-0.5 text-xs">
            {citations.map((c) => (
              <li key={c.url}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200"
                >
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** How the recorded parentage should be read; shown beside the Parents heading. */
const LINEAGE_STATUS_META: Record<LineageStatus, { label: string; className: string; title: string }> = {
  confirmed: {
    label: "confirmed",
    className: "text-green-500/80",
    title: "Breeder-stated or otherwise well-documented parentage.",
  },
  reported: {
    label: "reported",
    className: "text-zinc-500",
    title: "Commonly claimed parentage, not independently verified.",
  },
  disputed: {
    label: "disputed",
    className: "text-amber-500/90",
    title: "Sources disagree about this strain's parentage.",
  },
};

function ChipList({
  title,
  badge,
  items,
  onSelect,
  empty,
}: {
  title: string;
  badge?: { label: string; className: string; title: string };
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
        {badge && (
          <span className={`ml-2 normal-case tracking-normal ${badge.className}`} title={badge.title}>
            · {badge.label}
          </span>
        )}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-600">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
