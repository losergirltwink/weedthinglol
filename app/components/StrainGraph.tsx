"use client";

import { DirectedGraph } from "graphology";
import { SigmaContainer } from "@react-sigma/core";
import { NodeCircleProgram, EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import "@react-sigma/core/lib/style.css";

import { useStrainExplorer } from "@/app/lib/useStrainExplorer";
import { GraphController } from "./graph/GraphController";
import { SourcePanel } from "./graph/SourcePanel";
import { SearchPanel } from "./graph/SearchPanel";
import { FilterLegend } from "./graph/FilterLegend";
import { DetailPanel } from "./graph/DetailPanel";
import { RecommendPanel } from "./graph/RecommendPanel";
import { drawHover } from "./graph/drawHover";

const SIGMA_SETTINGS = {
  // Register renderers explicitly — relying on Sigma's implicit defaults left
  // the "circle"/"arrow" programs unregistered in this setup.
  nodeProgramClasses: { circle: NodeCircleProgram },
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
  } = useStrainExplorer();

  return (
    <div className="relative h-full w-full">
      {graph ? (
        // `key` per source: a new source is a new node set + layout, so remount
        // Sigma cleanly rather than diffing one graph into another.
        <SigmaContainer
          key={source}
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
            onSelect={setSelectedId}
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
          />
        )}
        {graph && (
          <RecommendPanel
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRecommendations={handleRecommendations}
          />
        )}
      </div>

      {/* Bottom-left: interactive legend / filters */}
      {graph && (
        <div className="absolute bottom-6 left-6">
          <FilterLegend activeTypes={activeTypes} onToggle={toggleType} />
        </div>
      )}
    </div>
  );
}
