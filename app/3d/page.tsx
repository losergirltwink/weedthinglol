import Link from "next/link";
import GraphExplorer3D from "../components/GraphExplorer3D";

export default function ThreeD() {
  return (
    <main className="relative flex-1 bg-zinc-950 text-zinc-100">
      <div className="absolute inset-0">
        <GraphExplorer3D />
      </div>

      <div className="pointer-events-none absolute left-0 top-0 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          🌿 Strain Genealogy <span className="text-zinc-500">· 3D</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Drag to orbit · scroll to zoom · click a strain to trace & recommend.
        </p>
        <Link
          href="/"
          className="pointer-events-auto mt-2 inline-block rounded-md bg-zinc-800/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur hover:bg-zinc-700"
        >
          ← Back to 2D
        </Link>
      </div>
    </main>
  );
}
