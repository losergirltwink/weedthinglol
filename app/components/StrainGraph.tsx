"use client";

import { useEffect, useState } from "react";
import { DirectedGraph } from "graphology";
import type { SerializedGraph } from "graphology-types";
import { SigmaContainer, useLoadGraph } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";

import type { StrainNodeAttributes } from "@/app/lib/strains";

function LoadStrainGraph({ onReady }: { onReady: () => void }) {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/graph.json");
      const data = (await res.json()) as SerializedGraph<StrainNodeAttributes>;
      if (cancelled) return;
      const graph = new DirectedGraph<StrainNodeAttributes>();
      graph.import(data);
      loadGraph(graph);
      onReady();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGraph, onReady]);

  return null;
}

export default function StrainGraph() {
  const [ready, setReady] = useState(false);

  return (
    <div className="relative h-full w-full">
      <SigmaContainer
        style={{ height: "100%", width: "100%", background: "transparent" }}
        settings={{
          defaultEdgeType: "arrow",
          renderEdgeLabels: false,
          labelColor: { color: "#e5e7eb" },
          labelSize: 13,
          labelDensity: 0.2,
          labelGridCellSize: 120,
          labelRenderedSizeThreshold: 8,
        }}
      >
        <LoadStrainGraph onReady={() => setReady(true)} />
      </SigmaContainer>

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Loading graph…
        </div>
      )}
    </div>
  );
}
