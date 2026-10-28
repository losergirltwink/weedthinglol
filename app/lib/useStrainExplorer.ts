"use client";

// Headless orchestration shared by both renderers (2D Sigma + 3D force-graph).
// Owns the graph load and the entire interaction state machine — selection,
// type filters, recommendations, and the derived focus/lit sets — so each
// renderer is a thin skin that only maps this state to its own draw API.
//
// Keep renderer-specific concerns OUT of here. If a checkpoint changes how
// selection or highlighting *works*, it changes once, here, and both views
// follow.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DirectedGraph } from "graphology";
import type { SerializedGraph } from "graphology-types";

import { STRAIN_TYPES, type StrainNodeAttributes, type StrainType } from "./strains";
import { computeFamily, type StrainGraphType } from "./graph-utils";
import { connectingPaths, insertPersonalStrains, keyIndex } from "./overlay-graph";
import type { Overlay } from "./overlay-types";
import { ALL_SOURCE, AVAILABLE_SOURCES, DEFAULT_SOURCE, type SourceOption } from "@/data/sources";

/** How many top-rated strains the favorite-paths highlight connects. */
const FAVORITES_FOR_PATHS = 5;

/** My journal, re-keyed to the loaded graph's node ids. */
export interface GraphOverlay {
  /** Mean rating in half-stars over the visible sessions (ring polarity pivot). */
  meanHalves: number | null;
  ratings: Map<string, { avgHalves: number; sessions: number }>;
  wishlist: Set<string>;
  /** Strains I've logged at least once, by strainKey (for excluding from recs). */
  triedKeys: Set<string>;
}

/** GET /api/overlay, or null if it fails (the explorer works without it). */
async function fetchOverlay(): Promise<Overlay | null> {
  try {
    const res = await fetch("/api/overlay", { cache: "no-store" });
    return res.ok ? ((await res.json()) as Overlay) : null;
  } catch {
    return null;
  }
}

export interface StrainExplorer {
  /** Loaded graph, or null while the active source's graph is fetching. */
  graph: StrainGraphType | null;
  /** Active data source id; selects which public/graph.<source>.json loads. */
  source: string;
  /** Switch source — refetches the graph and clears selection/recommendations. */
  setSource: (id: string) => void;
  /** Sources offered to the dropdown (real sources + `all` when >1 exists). */
  availableSources: readonly SourceOption[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  activeTypes: Set<StrainType>;
  toggleType: (type: StrainType) => void;
  recommendedSet: Set<string> | null;
  /** Callback for RecommendPanel to report its current results. */
  handleRecommendations: (ids: Set<string>) => void;
  /** Family line of the selected strain (ancestors ∪ self ∪ descendants), or null. */
  focusSet: Set<string> | null;
  /** What stays lit: family line ∪ recommendations. Null = nothing selected. */
  relevantSet: Set<string> | null;
  /** Raw personal overlay (profile, viewer), or null if unavailable. */
  overlay: Overlay | null;
  /** The overlay mapped onto the current graph's node ids. */
  graphOverlay: GraphOverlay | null;
  showFavoritePaths: boolean;
  setShowFavoritePaths: (on: boolean) => void;
  /** Nodes + edges connecting my favorites, when the toggle is on. */
  favoritePaths: { nodes: Set<string>; edges: Set<string> } | null;
  /** Reflect a want-to-try addition locally (after the server action succeeds). */
  markWishlisted: (strainKey: string) => void;
}

export function useStrainExplorer(): StrainExplorer {
  const [graph, setGraph] = useState<StrainGraphType | null>(null);
  const [source, setSourceState] = useState<string>(DEFAULT_SOURCE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<StrainType>>(
    () => new Set(STRAIN_TYPES),
  );
  const [recommendedSet, setRecommendedSet] = useState<Set<string> | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [showFavoritePaths, setShowFavoritePaths] = useState(false);
  // Fetched once per page view and shared across source switches.
  const overlayRequest = useRef<Promise<Overlay | null> | null>(null);

  // Refetch whenever the source changes. setSource nulls the graph first (the
  // loading state), so the renderer remounts cleanly on the new node set. The
  // overlay is awaited alongside so personal strains are part of the graph
  // BEFORE the renderer mounts (no post-mount mutation).
  useEffect(() => {
    let cancelled = false;
    overlayRequest.current ??= fetchOverlay();
    (async () => {
      const [res, ov] = await Promise.all([fetch(`/graph.${source}.json`), overlayRequest.current!]);
      const data = (await res.json()) as SerializedGraph<StrainNodeAttributes>;
      if (cancelled) return;
      const g = new DirectedGraph<StrainNodeAttributes>();
      g.import(data);
      if (ov) insertPersonalStrains(g, ov.personal, { includeUnplaced: source === ALL_SOURCE.id });
      setOverlay(ov);
      setGraph(g);
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Switching source invalidates the loaded graph and the current
  // selection/recommendations (their ids may not exist in the new graph). Reset
  // them here in the event handler; the effect above then refetches.
  const setSource = useCallback(
    (id: string) => {
      if (id === source) return;
      setGraph(null);
      setSourceState(id);
      setSelectedId(null);
      setRecommendedSet(null);
    },
    [source],
  );

  const focusSet = useMemo(
    () => (graph && selectedId ? computeFamily(graph, selectedId) : null),
    [graph, selectedId],
  );

  const relevantSet = useMemo(() => {
    if (!focusSet && !recommendedSet) return null;
    return new Set<string>([...(focusSet ?? []), ...(recommendedSet ?? [])]);
  }, [focusSet, recommendedSet]);

  const handleRecommendations = useCallback((ids: Set<string>) => {
    setRecommendedSet(ids.size ? ids : null);
  }, []);

  const toggleType = useCallback((type: StrainType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const graphOverlay = useMemo<GraphOverlay | null>(() => {
    if (!graph || !overlay) return null;
    const ids = keyIndex(graph);
    const ratings = new Map<string, { avgHalves: number; sessions: number }>();
    for (const [key, r] of Object.entries(overlay.ratings)) {
      const id = ids.get(key);
      if (id) ratings.set(id, r);
    }
    const wishlist = new Set(overlay.wishlist.map((k) => ids.get(k)).filter((x): x is string => !!x));
    return {
      meanHalves: overlay.profile.meanRating == null ? null : overlay.profile.meanRating * 2,
      ratings,
      wishlist,
      triedKeys: new Set(Object.keys(overlay.ratings)),
    };
  }, [graph, overlay]);

  const favoritePaths = useMemo(() => {
    if (!graph || !graphOverlay || !showFavoritePaths) return null;
    const mean = graphOverlay.meanHalves ?? 0;
    const favorites = [...graphOverlay.ratings]
      .filter(([, r]) => r.avgHalves > mean)
      .sort((a, b) => b[1].avgHalves - a[1].avgHalves)
      .slice(0, FAVORITES_FOR_PATHS)
      .map(([id]) => id);
    return connectingPaths(graph, favorites);
  }, [graph, graphOverlay, showFavoritePaths]);

  const markWishlisted = useCallback((strainKey: string) => {
    setOverlay((ov) => (ov && !ov.wishlist.includes(strainKey) ? { ...ov, wishlist: [...ov.wishlist, strainKey] } : ov));
  }, []);

  return {
    graph,
    source,
    setSource,
    availableSources: AVAILABLE_SOURCES,
    selectedId,
    setSelectedId,
    activeTypes,
    toggleType,
    recommendedSet,
    handleRecommendations,
    focusSet,
    relevantSet,
    overlay,
    graphOverlay,
    showFavoritePaths,
    setShowFavoritePaths,
    favoritePaths,
    markWishlisted,
  };
}
