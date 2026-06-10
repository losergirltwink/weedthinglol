"use client";

import { useMemo } from "react";

import { CONFIDENCE_META, type Confidence } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";

// Confidence gradient, most-trusted first — matches the union's curated-wins
// precedence and the order tiers should read in the key.
const ORDER: Confidence[] = ["curated", "documented", "crowd"];

interface Props {
  graph: StrainGraphType;
}

/**
 * Provenance key for the union view. The graph uses two visual channels: node
 * HUE encodes strain type (see FilterLegend), and BRIGHTNESS/SIZE encodes data
 * confidence — non-curated tiers recede at rest (GraphController's
 * `dimLowConfidence`). This explains that second channel, reusing the same tier
 * colors as the DetailPanel provenance badge.
 *
 * Auto-hides unless the loaded graph actually mixes confidence tiers, so it only
 * appears for the `all` union — a single-source view is uniform and needs no key.
 */
export function ProvenanceLegend({ graph }: Props) {
  const tiers = useMemo(() => {
    const present = new Set<Confidence>();
    graph.forEachNode((_n, a) => present.add(a.confidence));
    return ORDER.filter((c) => present.has(c));
  }, [graph]);

  if (tiers.length <= 1) return null;

  return (
    <div className="rounded-lg bg-zinc-900/85 p-3 text-sm shadow-lg backdrop-blur">
      <p className="mb-2 font-medium text-zinc-300">Data confidence</p>
      <ul className="space-y-1.5">
        {tiers.map((c) => {
          const meta = CONFIDENCE_META[c];
          return (
            <li key={c} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span className="text-zinc-300">{meta.label}</span>
              <span className="text-zinc-500">— {meta.blurb}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 border-t border-zinc-800 pt-2 text-xs leading-snug text-zinc-500">
        Node color is strain type; lower-confidence nodes are dimmed and shrunk at
        rest so the verified core stands out.
      </p>
    </div>
  );
}
