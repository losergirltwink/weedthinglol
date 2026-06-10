"use client";

import { useMemo, useState } from "react";
import type { StrainGraphType } from "@/app/lib/graph-utils";

interface Props {
  graph: StrainGraphType;
  onSelect: (id: string) => void;
}

export function SearchPanel({ graph, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { id: string; label: string }[] = [];
    graph.forEachNode((id, attrs) => {
      if (attrs.label.toLowerCase().includes(q)) out.push({ id, label: attrs.label });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 8);
  }, [graph, query]);

  return (
    <div className="rounded-lg bg-zinc-900/85 p-2 text-sm shadow-lg backdrop-blur">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search strains…"
        className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {results.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onSelect(r.id);
                  setQuery("");
                }}
                className="w-full rounded-md px-3 py-1 text-left text-zinc-300 hover:bg-zinc-800"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
