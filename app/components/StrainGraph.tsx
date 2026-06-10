"use client";

import { useEffect } from "react";
import { DirectedGraph } from "graphology";
import { SigmaContainer, useLoadGraph } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";

import { STRAINS, LINEAGE, TYPE_COLORS } from "@/app/lib/strains";

function LoadStrainGraph() {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new DirectedGraph();

    for (const s of STRAINS) {
      graph.addNode(s.id, {
        label: s.name,
        x: s.x,
        y: s.y,
        size: 12,
        color: TYPE_COLORS[s.type],
      });
    }

    for (const e of LINEAGE) {
      graph.addEdgeWithKey(`${e.parent}->${e.child}`, e.parent, e.child, {
        size: 2,
        color: "#9ca3af",
        type: "arrow",
      });
    }

    loadGraph(graph);
  }, [loadGraph]);

  return null;
}

export default function StrainGraph() {
  return (
    <SigmaContainer
      style={{ height: "100%", width: "100%", background: "transparent" }}
      settings={{
        defaultEdgeType: "arrow",
        renderEdgeLabels: false,
        labelColor: { color: "#e5e7eb" },
        labelSize: 14,
      }}
    >
      <LoadStrainGraph />
    </SigmaContainer>
  );
}
