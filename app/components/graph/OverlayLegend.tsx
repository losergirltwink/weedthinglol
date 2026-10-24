"use client";

import { RING } from "@/app/lib/overlay-types";
import type { GraphOverlay } from "@/app/lib/useStrainExplorer";

/**
 * Key for my journal layer on the graph (bottom-left, with the other legends).
 * Hidden until there's something of mine on the graph. Ring width differs too:
 * want-to-try is thinner, so it's never color alone.
 */
export function OverlayLegend({
  graphOverlay,
  showFavoritePaths,
  onToggleFavoritePaths,
}: {
  graphOverlay: GraphOverlay | null;
  showFavoritePaths: boolean;
  onToggleFavoritePaths: (on: boolean) => void;
}) {
  if (!graphOverlay || (graphOverlay.ratings.size === 0 && graphOverlay.wishlist.size === 0)) return null;
  const rated = graphOverlay.ratings.size;

  return (
    <div className="rounded-lg bg-zinc-900/85 p-3 text-sm shadow-lg backdrop-blur">
      <p className="mb-2 font-medium text-zinc-300">My journal</p>
      <ul className="space-y-1.5 text-zinc-300">
        {rated > 0 && (
          <>
            <Item color={RING.above} width={3}>
              rated above my average
            </Item>
            <Item color={RING.below} width={3}>
              rated below my average
            </Item>
          </>
        )}
        {graphOverlay.wishlist.size > 0 && (
          <Item color={RING.wishlist} width={1.5}>
            want to try
          </Item>
        )}
      </ul>
      {rated >= 2 && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={showFavoritePaths}
            onChange={(e) => onToggleFavoritePaths(e.target.checked)}
            className="accent-zinc-200"
          />
          Show how my favorites connect
        </label>
      )}
    </div>
  );
}

function Item({ color, width, children }: { color: string; width: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full bg-zinc-600"
        style={{ boxShadow: `0 0 0 ${width}px ${color}` }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}
