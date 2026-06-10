"use client";

// SPIKE: a 3D rendering of the same strain graph using react-force-graph-3d
// (Three.js + d3-force-3d), for side-by-side comparison with the 2D Sigma
// version at "/". Reuses the exact same data, scoring, and panels — only the
// renderer and layout differ.

import { useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { Object3D } from "three";
import SpriteText from "three-spritetext";

import type { StrainType } from "@/app/lib/strains";
import { useStrainExplorer } from "@/app/lib/useStrainExplorer";
import { SourcePanel } from "./graph/SourcePanel";
import { SearchPanel } from "./graph/SearchPanel";
import { FilterLegend } from "./graph/FilterLegend";
import { DetailPanel } from "./graph/DetailPanel";
import { RecommendPanel } from "./graph/RecommendPanel";

const DIM_NODE = "#3f3f46"; // zinc-700
const DIM_EDGE = "#1f2937"; // gray-800
const FOCUS_EDGE = "#6b7280"; // gray-500

interface Node3D {
  id: string;
  label: string;
  strainType: StrainType;
  size: number;
  color: string;
  x?: number;
  y?: number;
  z?: number;
}
interface Link3D {
  source: string | Node3D;
  target: string | Node3D;
}

const linkId = (e: string | Node3D) => (typeof e === "object" ? e.id : e);

export default function StrainGraph3D() {
  // Shared interaction state machine (selection, filters, recs, lit sets).
  const {
    graph,
    source,
    setSource,
    availableSources,
    selectedId,
    setSelectedId,
    activeTypes,
    toggleType,
    relevantSet,
    handleRecommendations,
  } = useStrainExplorer();

  // react-force-graph instance handle, for camera control. Typed loosely: the
  // library's generic ForceGraphMethods type is awkward to spell out here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  // Build the {nodes, links} payload once — keeping it stable so the force
  // simulation lays out a single time instead of thrashing on every filter.
  const graphData = useMemo(() => {
    if (!graph) return { nodes: [] as Node3D[], links: [] as Link3D[] };
    const nodes: Node3D[] = graph.mapNodes((id, a) => ({
      id,
      label: a.label,
      strainType: a.strainType,
      size: a.size,
      color: a.color,
    }));
    const links: Link3D[] = graph.mapEdges((_e, _a, s, t) => ({ source: s, target: t }));
    return { nodes, links };
  }, [graph]);

  // Fly the camera to the selected node once the layout has positions.
  useEffect(() => {
    if (!selectedId || !fgRef.current) return;
    const node = graphData.nodes.find((n) => n.id === selectedId);
    if (!node || node.x == null) return;
    const d = Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1;
    const ratio = 1 + 90 / d;
    fgRef.current.cameraPosition(
      { x: node.x * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
      node,
      800,
    );
  }, [selectedId, graphData]);

  if (!graph) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
        Loading graph…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#09090b"
        showNavInfo={false}
        nodeId="id"
        nodeVal={(n: Node3D) => n.size}
        nodeLabel={(n: Node3D) => n.label}
        nodeColor={(n: Node3D) =>
          relevantSet && !relevantSet.has(n.id) ? DIM_NODE : n.color
        }
        nodeVisibility={(n: Node3D) => activeTypes.has(n.strainType)}
        nodeOpacity={0.9}
        nodeThreeObjectExtend
        nodeThreeObject={(n: Node3D) => {
          // Always-on label for the lit set; others rely on hover tooltip.
          // undefined => fall back to the default sphere (valid at runtime).
          if (!relevantSet || !relevantSet.has(n.id))
            return undefined as unknown as Object3D;
          const sprite = new SpriteText(n.label);
          sprite.color = "#f4f4f5";
          sprite.textHeight = 4;
          sprite.position.set(0, n.size + 4, 0);
          return sprite;
        }}
        linkVisibility={(l: Link3D) =>
          activeTypes.has(
            graph.getNodeAttribute(linkId(l.source), "strainType"),
          ) &&
          activeTypes.has(graph.getNodeAttribute(linkId(l.target), "strainType"))
        }
        linkColor={(l: Link3D) => {
          if (
            relevantSet &&
            !(relevantSet.has(linkId(l.source)) && relevantSet.has(linkId(l.target)))
          )
            return DIM_EDGE;
          return FOCUS_EDGE;
        }}
        linkWidth={0.6}
        linkOpacity={0.5}
        linkDirectionalArrowLength={2.5}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(n: Node3D) => setSelectedId(n.id)}
        onBackgroundClick={() => setSelectedId(null)}
      />

      {/* Right column: source + search + detail + recommendations (shared with 2D) */}
      <div className="absolute right-6 top-6 flex max-h-[calc(100%-3rem)] w-72 flex-col gap-3 overflow-y-auto">
        <SourcePanel sources={availableSources} value={source} onChange={setSource} />
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

      {/* Bottom-left: interactive legend / filters (shared with 2D) */}
      <div className="absolute bottom-6 left-6">
        <FilterLegend activeTypes={activeTypes} onToggle={toggleType} />
      </div>
    </div>
  );
}
