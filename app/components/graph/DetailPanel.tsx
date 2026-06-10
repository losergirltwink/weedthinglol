"use client";

import { TYPE_COLORS, type StrainType } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";

interface Props {
  graph: StrainGraphType;
  id: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function DetailPanel({ graph, id, onSelect, onClose }: Props) {
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

  return (
    <div className="rounded-lg bg-zinc-900/90 p-4 text-sm shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">{attrs.label}</h2>
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
      </div>

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

      {attrs.note && (
        <p className="mt-3 text-xs italic leading-relaxed text-zinc-500">{attrs.note}</p>
      )}

      <ChipList title="Parents" items={parents} onSelect={onSelect} empty="Landrace / root" />
      <ChipList title="Children" items={children} onSelect={onSelect} empty="None recorded" />
    </div>
  );
}

function ChipList({
  title,
  items,
  onSelect,
  empty,
}: {
  title: string;
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
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
