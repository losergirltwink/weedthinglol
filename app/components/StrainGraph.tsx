"use client";

import { DirectedGraph } from "graphology";
import { SigmaContainer } from "@react-sigma/core";
import { NodeCircleProgram, EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import "@react-sigma/core/lib/style.css";

import { useStrainExplorer } from "@/app/lib/useStrainExplorer";
import { GraphController } from "./graph/GraphController";
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
    selectedId,
    setSelectedId,
    activeTypes,
    toggleType,
    recommendedSet,
    handleRecommendations,
    focusSet,
  } = useStrainExplorer();

  if (!graph) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
        Loading graph…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <SigmaContainer
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

      {/* Right column: search + detail + recommendations */}
      <div className="absolute right-6 top-6 flex max-h-[calc(100%-3rem)] w-72 flex-col gap-3 overflow-y-auto">
        <SearchPanel graph={graph} onSelect={setSelectedId} />
        {selectedId && (
          <DetailPanel
            graph={graph}
            id={selectedId}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
        <RecommendPanel
          graph={graph}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRecommendations={handleRecommendations}
        />
      </div>

      {/* Bottom-left: interactive legend / filters */}
      <div className="absolute bottom-6 left-6">
        <FilterLegend activeTypes={activeTypes} onToggle={toggleType} />
      </div>
    </div>
  );
}
