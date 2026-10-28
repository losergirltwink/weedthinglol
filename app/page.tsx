import Link from "next/link";
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
        <nav className="pointer-events-auto mt-2 flex flex-wrap gap-2 text-xs">
          {[
            ["/journal", "Journal"],
            ["/profile", "Profile"],
            ["/about", "About"],
            ["/3d", "Try 3D view →"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md bg-zinc-800/80 px-3 py-1 text-zinc-300 backdrop-blur hover:bg-zinc-700"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
