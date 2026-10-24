"use client";

import { useCallback, useState } from "react";
import { DirectedGraph } from "graphology";
import { SigmaContainer } from "@react-sigma/core";
import { NodeCircleProgram, EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import { createNodeBorderProgram } from "@sigma/node-border";
import "@react-sigma/core/lib/style.css";

import { useStrainExplorer } from "@/app/lib/useStrainExplorer";
import { ALL_SOURCE } from "@/data/sources";
import { GraphController } from "./graph/GraphController";
import { SourcePanel } from "./graph/SourcePanel";
import { SearchPanel } from "./graph/SearchPanel";
import { FilterLegend } from "./graph/FilterLegend";
import { ProvenanceLegend } from "./graph/ProvenanceLegend";
import { DetailPanel } from "./graph/DetailPanel";
import { RecommendPanel } from "./graph/RecommendPanel";
import { OverlayLegend } from "./graph/OverlayLegend";
import { drawHover } from "./graph/drawHover";

// Circle with an optional outer ring for my journal overlay (rating / want-to-try).
// The ring's color + width come from node attributes set in the reducer.
const NodeRingProgram = createNodeBorderProgram({
  borders: [
    { size: { attribute: "ringSize", defaultValue: 0, mode: "relative" }, color: { attribute: "ringColor" } },
    { size: { fill: true }, color: { attribute: "color" } },
  ],
  drawHover,
});

const SIGMA_SETTINGS = {
  // Register renderers explicitly — relying on Sigma's implicit defaults left
  // the "circle"/"arrow" programs unregistered in this setup.
  nodeProgramClasses: { circle: NodeCircleProgram, bordered: NodeRingProgram },
  edgeProgramClasses: { arrow: EdgeArrowProgram, line: EdgeRectangleProgram },
  defaultNodeType: "circle",
  defaultEdgeType: "arrow",
  renderEdgeLabels: false,
  labelColor: { color: "#e5e7eb" },
  labelSize: 13,
  labelDensity: 0.3,
  labelGridCellSize: 120,
  labelRenderedSizeThreshold: 8,
  defaultDrawNodeHover: drawHover,
};

export default function StrainGraph() {
  const {
    graph,
    source,
    setSource,
    availableSources,
    selectedId,
    setSelectedId,
    activeTypes,
    toggleType,
    recommendedSet,
    handleRecommendations,
    focusSet,
    overlay,
    graphOverlay,
    showFavoritePaths,
    setShowFavoritePaths,
    favoritePaths,
    markWishlisted,
  } = useStrainExplorer();

  // Bumped to remount the SigmaContainer once a lost WebGL context is restored.
  const [glGeneration, setGlGeneration] = useState(0);
  const handleContextRestored = useCallback(() => {
    console.warn("Sigma WebGL context restored — remounting renderer to recover.");
    setGlGeneration((g) => g + 1);
  }, []);

  return (
    <div className="relative h-full w-full">
      {graph ? (
        // `key` per source: a new source is a new node set + layout, so remount
        // Sigma cleanly rather than diffing one graph into another. The
        // generation suffix forces the same clean remount after a lost GL context.
        <SigmaContainer
          key={`${source}-${glGeneration}`}
          graph={DirectedGraph}
          style={{ height: "100%", width: "100%", background: "transparent" }}
          settings={SIGMA_SETTINGS}
        >
          <GraphController
            graph={graph}
            selectedId={selectedId}
            focusSet={focusSet}
            highlightSet={recommendedSet}
            activeTypes={activeTypes}
            dimLowConfidence={source === ALL_SOURCE.id}
            onSelect={setSelectedId}
            onContextRestored={handleContextRestored}
            graphOverlay={graphOverlay}
            favoritePaths={favoritePaths}
          />
        </SigmaContainer>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
          Loading graph…
        </div>
      )}

      {/* Right column: source + search + detail + recommendations. The source
          selector stays mounted across loads so you can always switch back. */}
      <div className="absolute right-6 top-6 flex max-h-[calc(100%-3rem)] w-72 flex-col gap-3 overflow-y-auto">
        <SourcePanel sources={availableSources} value={source} onChange={setSource} />
        {graph && <SearchPanel graph={graph} onSelect={setSelectedId} />}
        {graph && selectedId && (
          <DetailPanel
            graph={graph}
            id={selectedId}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
            myRating={graphOverlay?.ratings.get(selectedId)}
            wishlisted={graphOverlay?.wishlist.has(selectedId) ?? false}
          />
        )}
        {graph && (
          <RecommendPanel
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRecommendations={handleRecommendations}
            overlay={overlay}
            graphOverlay={graphOverlay}
            onWishlisted={markWishlisted}
          />
        )}
      </div>

      {/* Bottom-left: provenance key (union only) + interactive type filter */}
      {graph && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-3">
          <OverlayLegend
            graphOverlay={graphOverlay}
            showFavoritePaths={showFavoritePaths}
            onToggleFavoritePaths={setShowFavoritePaths}
          />
          <ProvenanceLegend graph={graph} />
          <FilterLegend activeTypes={activeTypes} onToggle={toggleType} />
        </div>
      )}
    </div>
  );
}
