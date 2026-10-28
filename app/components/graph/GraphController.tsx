"use client";

import { useEffect, useState } from "react";
import {
  useSigma,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
} from "@react-sigma/core";
import { drawDiscNodeLabel } from "sigma/rendering";

import type { StrainType } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";
import { RING } from "@/app/lib/overlay-types";
import type { GraphOverlay } from "@/app/lib/useStrainExplorer";

// Ring widths (relative to node size). Want-to-try is deliberately thinner than
// a rating ring: width is its secondary encoding beside the aqua color.
const RATED_RING = 0.3;
const WISHLIST_RING = 0.15;
/** Within ±this many half-stars of my mean, a rating reads as neutral. */
const NEUTRAL_BAND = 0.5;
const PATH_EDGE_SIZE = 3;

const DIM_NODE = "#3f3f46"; // zinc-700
const DIM_EDGE = "#1f2937"; // gray-800
const FOCUS_EDGE = "#6b7280"; // gray-500

const MUTE_BG = [24, 24, 27]; // zinc-900 — what muted nodes blend toward

/** Blend a hex color toward the dark background to de-emphasize a node. */
function mute(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const ch = (i: number) => parseInt(h.slice(i, i + 2), 16);
  const mix = (c: number, bg: number) => Math.round(c * (1 - amount) + bg * amount);
  return (
    "#" +
    [mix(ch(0), MUTE_BG[0]), mix(ch(2), MUTE_BG[1]), mix(ch(4), MUTE_BG[2])]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

interface Props {
  graph: StrainGraphType;
  selectedId: string | null;
  /** Family line of the selected node (ancestors + self + descendants), or null. */
  focusSet: Set<string> | null;
  /** Recommended strains to keep lit alongside the family line, or null. */
  highlightSet: Set<string> | null;
  activeTypes: Set<StrainType>;
  /** Union view: mute non-curated nodes at rest so the verified core stands out. */
  dimLowConfidence: boolean;
  onSelect: (id: string | null) => void;
  /** Fired once the WebGL context is restored, so the parent can remount Sigma. */
  onContextRestored: () => void;
  /** My journal on this graph (rating + want-to-try rings), or null. */
  graphOverlay: GraphOverlay | null;
  /** "How my favorites connect" highlight, or null when off. */
  favoritePaths: { nodes: Set<string>; edges: Set<string> } | null;
}

export function GraphController({
  graph,
  selectedId,
  focusSet,
  highlightSet,
  activeTypes,
  dimLowConfidence,
  onSelect,
  onContextRestored,
  graphOverlay,
  favoritePaths,
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

  // WebGL context loss (GPU reclaim, tab backgrounding, large scenes on weak
  // GPUs) leaves Sigma's canvases frozen/ghosted. preventDefault on the loss
  // event tells the browser to restore the context; we wait for the
  // `webglcontextrestored` event before asking the parent to remount Sigma.
  // Recreating it on the loss event instead races a still-dead GPU and fails to
  // compile node programs ("could not find a suitable program for circle").
  useEffect(() => {
    const canvases = Array.from(
      sigma.getContainer().querySelectorAll("canvas"),
    );
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => onContextRestored();
    canvases.forEach((c) => {
      c.addEventListener("webglcontextlost", onLost);
      c.addEventListener("webglcontextrestored", onRestored);
    });
    return () =>
      canvases.forEach((c) => {
        c.removeEventListener("webglcontextlost", onLost);
        c.removeEventListener("webglcontextrestored", onRestored);
      });
  }, [sigma, onContextRestored]);

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

    // The lit set: selected strain's family line ∪ recommended strains ∪ (when
    // toggled on) the paths connecting my favorites.
    const relevantSet =
      focusSet || highlightSet || favoritePaths
        ? new Set<string>([...(focusSet ?? []), ...(highlightSet ?? []), ...(favoritePaths?.nodes ?? [])])
        : null;

    const ringFor = (node: string): { ringColor: string; ringSize: number } | null => {
      const rating = graphOverlay?.ratings.get(node);
      if (rating) {
        const diff = rating.avgHalves - (graphOverlay?.meanHalves ?? rating.avgHalves);
        const ringColor = diff > NEUTRAL_BAND ? RING.above : diff < -NEUTRAL_BAND ? RING.below : RING.neutral;
        return { ringColor, ringSize: RATED_RING };
      }
      if (graphOverlay?.wishlist.has(node)) return { ringColor: RING.wishlist, ringSize: WISHLIST_RING };
      return null;
    };

    const isDimmed = (node: string) =>
      (relevantSet !== null && !relevantSet.has(node)) ||
      (hoverSet !== null && !hoverSet.has(node));

    setSettings({
      // The selected node and the hovered node are labeled by the hover renderer
      // (drawHover), which draws their label inside a dark box. Sigma's regular
      // label pass doesn't know that and would draw the SAME label again at a
      // slightly different offset — a doubled/ghosted label, very visible zoomed
      // in. Skip those two here so each is labeled exactly once.
      defaultDrawNodeLabel: (context, data, labelSettings) => {
        const key = (data as { key?: string }).key;
        if (key === selectedId || key === hovered) return;
        drawDiscNodeLabel(context, data, labelSettings);
      },

      nodeReducer: (node, data) => {
        if (!activeTypes.has(data.strainType as StrainType)) {
          return { ...data, hidden: true };
        }
        if (isDimmed(node)) {
          return { ...data, color: DIM_NODE, label: "", zIndex: 0 };
        }
        const emphasized = relevantSet !== null || hoverSet !== null;
        const isRecommended = highlightSet?.has(node) ?? false;
        // At rest (nothing selected/hovered) two de-emphasis channels apply, both
        // lifted the moment you engage the graph so exploration shows everything:
        //   • union view mutes non-curated nodes so the verified core dominates;
        //   • cross-expression nodes ("A x B") shrink + drop their label so the
        //     named-cultivar backbone reads clearly (they're connective tissue).
        // My own strains (rated / want-to-try) are never muted at rest.
        const ring = ringFor(node);
        const restingLowConf =
          dimLowConfidence && !emphasized && !ring && data.confidence !== "curated";
        const restingCross = !emphasized && !ring && data.nameKind === "cross";
        let color = data.color ?? DIM_NODE;
        let size = data.size ?? 1;
        if (restingLowConf) {
          color = mute(color, 0.5);
          size *= 0.7;
        }
        if (restingCross) size *= 0.85;
        return {
          ...data,
          color,
          size,
          ...(restingCross ? { label: "" } : {}),
          ...(ring ? { type: "bordered", ...ring } : {}),
          zIndex: node === selectedId ? 3 : isRecommended ? 2 : ring ? 2 : 1,
          // Rated strains keep their labels at rest: they're my landmarks.
          forceLabel: emphasized || (ring && graphOverlay?.ratings.has(node)) || undefined,
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
        if (favoritePaths?.edges.has(edge)) {
          return { ...data, color: RING.above, size: PATH_EDGE_SIZE, zIndex: 2 };
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
    dimLowConfidence,
    hovered,
    graphOverlay,
    favoritePaths,
  ]);

  return null;
}
