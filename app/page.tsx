import GraphExplorer from "./components/GraphExplorer";

export default function Home() {
  return (
    <main className="relative flex-1 bg-zinc-950 text-zinc-100">
      {/* Graph canvas fills the screen */}
      <div className="absolute inset-0">
        <GraphExplorer />
      </div>

      {/* Header overlay */}
      <div className="pointer-events-none absolute left-0 top-0 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          🌿 Strain Genealogy
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Click a strain to trace its lineage & find similar · or match by effect.
        </p>
      </div>
    </main>
  );
}
