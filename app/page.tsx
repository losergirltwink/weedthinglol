import GraphExplorer from "./components/GraphExplorer";
import { TYPE_COLORS } from "./lib/strains";

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
          Phase 0 — dummy graph. Scroll to zoom, drag to pan.
        </p>
      </div>

      {/* Legend overlay */}
      <div className="absolute bottom-6 left-6 rounded-lg bg-zinc-900/80 p-4 text-sm backdrop-blur">
        <p className="mb-2 font-medium text-zinc-300">Type</p>
        <ul className="space-y-1">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <li key={type} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize text-zinc-300">{type}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
