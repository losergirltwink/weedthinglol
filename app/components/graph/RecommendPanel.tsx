"use client";

import { useEffect, useMemo, useState } from "react";

import { TYPE_COLORS, type StrainType } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";
import { allEffects, recommend, type Recommendation } from "@/app/lib/recommend";

interface Props {
  graph: StrainGraphType;
  /** When set, panel recommends strains similar to this one. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Reports the currently-recommended node ids so the graph can light them. */
  onRecommendations: (ids: Set<string>) => void;
}

export function RecommendPanel({
  graph,
  selectedId,
  onSelect,
  onRecommendations,
}: Props) {
  // Effect-finder selections (only used when nothing is selected).
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const effects = useMemo(() => allEffects(graph), [graph]);

  const recs = useMemo<Recommendation[]>(() => {
    if (selectedId) return recommend(graph, { seedId: selectedId, limit: 6 });
    if (picked.size) return recommend(graph, { effects: picked, limit: 8 });
    return [];
  }, [graph, selectedId, picked]);

  const recIds = useMemo(() => new Set(recs.map((r) => r.id)), [recs]);
  useEffect(() => onRecommendations(recIds), [recIds, onRecommendations]);

  const seedLabel = selectedId
    ? graph.getNodeAttribute(selectedId, "label")
    : null;

  const togglePicked = (effect: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(effect)) next.delete(effect);
      else next.add(effect);
      return next;
    });

  return (
    <div className="rounded-lg bg-zinc-900/90 p-4 text-sm shadow-lg backdrop-blur">
      <p className="mb-2 font-medium text-zinc-200">
        {seedLabel ? (
          <>
            Similar to{" "}
            <span className="text-zinc-50">{seedLabel}</span>
          </>
        ) : (
          "Find by effect"
        )}
      </p>

      {/* Effect picker — only when there's no seed strain. */}
      {!selectedId && (
        <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {effects.map((e) => {
            const on = picked.has(e);
            return (
              <button
                key={e}
                onClick={() => togglePicked(e)}
                className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${
                  on
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}

      {recs.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {selectedId
            ? "No similar strains found."
            : "Pick a few effects to see matches."}
        </p>
      ) : (
        <ul className="space-y-2">
          {recs.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onSelect(r.id)}
                className="w-full rounded-md p-2 text-left hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        TYPE_COLORS[
                          graph.getNodeAttribute(r.id, "strainType") as StrainType
                        ],
                    }}
                  />
                  <span className="flex-1 truncate text-zinc-100">{r.label}</span>
                  <ScoreBar value={r.score} />
                </div>

                {r.sharedEffects.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-4.5">
                    {r.sharedEffects.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-zinc-800 px-1.5 text-[10px] capitalize text-emerald-300"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}

                {r.commonAncestor && (
                  <p className="mt-1 pl-4.5 text-[10px] text-zinc-500">
                    shares ancestor {r.commonAncestor.label}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <span
      className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800"
      title={`${Math.round(value * 100)}% match`}
    >
      <span
        className="block h-full rounded-full bg-emerald-500"
        style={{ width: `${Math.max(6, Math.round(value * 100))}%` }}
      />
    </span>
  );
}
