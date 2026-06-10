"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DirectedGraph } from "graphology";
import type { SerializedGraph } from "graphology-types";
import { SigmaContainer } from "@react-sigma/core";
import { NodeCircleProgram, EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
import "@react-sigma/core/lib/style.css";

import { STRAIN_TYPES, type StrainNodeAttributes, type StrainType } from "@/app/lib/strains";
import { computeFamily, type StrainGraphType } from "@/app/lib/graph-utils";
import { GraphController } from "./graph/GraphController";
import { SearchPanel } from "./graph/SearchPanel";
import { FilterLegend } from "./graph/FilterLegend";
import { DetailPanel } from "./graph/DetailPanel";
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
  const [graph, setGraph] = useState<StrainGraphType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<StrainType>>(
    () => new Set(STRAIN_TYPES),
  );

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

  const toggleType = useCallback((type: StrainType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

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
          activeTypes={activeTypes}
          onSelect={setSelectedId}
        />
      </SigmaContainer>

      {/* Right column: search + detail */}
      <div className="absolute right-6 top-6 flex w-72 flex-col gap-3">
        <SearchPanel graph={graph} onSelect={setSelectedId} />
        {selectedId && (
          <DetailPanel
            graph={graph}
            id={selectedId}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Bottom-left: interactive legend / filters */}
      <div className="absolute bottom-6 left-6">
        <FilterLegend activeTypes={activeTypes} onToggle={toggleType} />
      </div>
    </div>
  );
}
