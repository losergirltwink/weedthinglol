"use client";

import dynamic from "next/dynamic";

// Sigma touches the DOM/canvas, so it must only run in the browser.
const StrainGraph = dynamic(() => import("./StrainGraph"), { ssr: false });

export default function GraphExplorer() {
  return <StrainGraph />;
}
