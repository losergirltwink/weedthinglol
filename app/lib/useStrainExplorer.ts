"use client";

// Headless orchestration shared by both renderers (2D Sigma + 3D force-graph).
// Owns the graph load and the entire interaction state machine — selection,
// type filters, recommendations, and the derived focus/lit sets — so each
// renderer is a thin skin that only maps this state to its own draw API.
//
// Keep renderer-specific concerns OUT of here. If a checkpoint changes how
// selection or highlighting *works*, it changes once, here, and both views
// follow.

import { useCallback, useEffect, useMemo, useState } from "react";
import { DirectedGraph } from "graphology";
import type { SerializedGraph } from "graphology-types";

import { STRAIN_TYPES, type StrainNodeAttributes, type StrainType } from "./strains";
import { computeFamily, type StrainGraphType } from "./graph-utils";

export interface StrainExplorer {
  /** Loaded graph, or null until the fetch resolves. */
  graph: StrainGraphType | null;
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
}

export function useStrainExplorer(): StrainExplorer {
  const [graph, setGraph] = useState<StrainGraphType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<StrainType>>(
    () => new Set(STRAIN_TYPES),
  );
  const [recommendedSet, setRecommendedSet] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/graph.json");
      const data = (await res.json()) as SerializedGraph<StrainNodeAttributes>;
      if (cancelled) return;
      const g = new DirectedGraph<StrainNodeAttributes>();
      g.import(data);
      setGraph(g);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return {
    graph,
    selectedId,
    setSelectedId,
    activeTypes,
    toggleType,
    recommendedSet,
    handleRecommendations,
    focusSet,
    relevantSet,
  };
}
