"use client";

import { useEffect, useState } from "react";
import {
  useSigma,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
} from "@react-sigma/core";

import type { StrainType } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";

const DIM_NODE = "#3f3f46"; // zinc-700
const DIM_EDGE = "#1f2937"; // gray-800
const FOCUS_EDGE = "#6b7280"; // gray-500

interface Props {
  graph: StrainGraphType;
  selectedId: string | null;
  /** Family line of the selected node (ancestors + self + descendants), or null. */
  focusSet: Set<string> | null;
  /** Recommended strains to keep lit alongside the family line, or null. */
  highlightSet: Set<string> | null;
  activeTypes: Set<StrainType>;
  onSelect: (id: string | null) => void;
}

export function GraphController({
  graph,
  selectedId,
  focusSet,
  highlightSet,
  activeTypes,
  onSelect,
}: Props) {
  const sigma = useSigma();
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const [hovered, setHovered] = useState<string | null>(null);

  // Load the precomputed graph into Sigma once.
  useEffect(() => {
    loadGraph(graph);
  }, [loadGraph, graph]);

  // Wire interactions.
  useEffect(() => {
    registerEvents({
      clickNode: (e) => onSelect(e.node),
      clickStage: () => onSelect(null),
      enterNode: (e) => setHovered(e.node),
      leaveNode: () => setHovered(null),
    });
  }, [registerEvents, onSelect]);

  // Pan/zoom the camera to the selected node.
  useEffect(() => {
    if (!selectedId) return;
    const pos = sigma.getNodeDisplayData(selectedId);
    if (!pos) return;
    sigma.getCamera().animate(
      { x: pos.x, y: pos.y, ratio: 0.55 },
      { duration: 500 },
    );
  }, [sigma, selectedId]);

  // Recompute reducers whenever selection / hover / filters / recs change.
  useEffect(() => {
    const hoverSet = hovered
      ? new Set<string>([hovered, ...graph.neighbors(hovered)])
      : null;

    // The lit set: selected strain's family line ∪ recommended strains.
    const relevantSet =
      focusSet || highlightSet
        ? new Set<string>([...(focusSet ?? []), ...(highlightSet ?? [])])
        : null;

    const isDimmed = (node: string) =>
      (relevantSet !== null && !relevantSet.has(node)) ||
      (hoverSet !== null && !hoverSet.has(node));

    setSettings({
      nodeReducer: (node, data) => {
        if (!activeTypes.has(data.strainType as StrainType)) {
          return { ...data, hidden: true };
        }
        if (isDimmed(node)) {
          return { ...data, color: DIM_NODE, label: "", zIndex: 0 };
        }
        const emphasized = relevantSet !== null || hoverSet !== null;
        const isRecommended = highlightSet?.has(node) ?? false;
        return {
          ...data,
          zIndex: node === selectedId ? 3 : isRecommended ? 2 : 1,
          forceLabel: emphasized || undefined,
          highlighted: node === selectedId,
        };
      },

      edgeReducer: (edge, data) => {
        const source = graph.source(edge);
        const target = graph.target(edge);
        const endpointsActive =
          activeTypes.has(graph.getNodeAttribute(source, "strainType")) &&
          activeTypes.has(graph.getNodeAttribute(target, "strainType"));
        if (!endpointsActive) return { ...data, hidden: true };

        const inFocus =
          (relevantSet === null ||
            (relevantSet.has(source) && relevantSet.has(target))) &&
          (hoverSet === null || (hoverSet.has(source) && hoverSet.has(target)));

        if ((relevantSet !== null || hoverSet !== null) && !inFocus) {
          return { ...data, color: DIM_EDGE, zIndex: 0 };
        }
        return { ...data, color: FOCUS_EDGE, zIndex: 1 };
      },
    });

    sigma.refresh();
  }, [
    setSettings,
    sigma,
    graph,
    selectedId,
    focusSet,
    highlightSet,
    activeTypes,
    hovered,
  ]);

  return null;
}
