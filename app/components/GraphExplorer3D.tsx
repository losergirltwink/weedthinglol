"use client";

import dynamic from "next/dynamic";

// react-force-graph-3d touches window/WebGL, so it must stay browser-only.
const StrainGraph3D = dynamic(() => import("./StrainGraph3D"), { ssr: false });

export default function GraphExplorer3D() {
  return <StrainGraph3D />;
}
