# CLAUDE.md

Guidance for Claude Code working in this repo. Keep this current at phase
boundaries.

## What this is

An explorable, interactive graph visualization of well-documented cannabis
strains and their lineage (strains are crosses of other strains, forming a deep
ancestry DAG). Goals: trace lineage, explore the data for fun, and help a user
target a strain they'll like via effect + lineage similarity.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4, Turbopack) + **React 19**
- **2D renderer (primary):** Sigma.js 3 + @react-sigma/core over **Graphology**
  (DirectedGraph). WebGL.
- **3D renderer (experimental):** react-force-graph-3d (Three.js + d3-force-3d).
- **Layout:** ForceAtlas2 baked **offline** into `public/graph.json`; the 2D
  browser does zero layout. (The 3D view lays out live in-browser.)
- **Data:** hand-curated static JSON, compiled to a single graph file. No
  backend, no DB. All state is transient client state.

## Package manager: pnpm

This is a pnpm project (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). **Use pnpm, not
npm.** Native build deps (sharp, unrs-resolver, esbuild) must stay `true` under
`allowBuilds:` in `pnpm-workspace.yaml`, or `pnpm install` exits 1 and breaks
`next build`'s dependency check.

## Commands

- `pnpm dev` — dev server (port 3000). Browser console errors are captured in
  `.next/dev/logs/next-development.log` — useful since the renderers are
  client-only and won't surface via `curl`.
- `pnpm build` — production build / typecheck.
- `pnpm build:graph` — **regenerate `public/graph.json` from `data/*.json`.** Run
  this after any data edit.
- `pnpm exec tsc --noEmit` — typecheck. There is no headless browser here, so
  verify via tsc + eslint + the dev log, not a real render.

## Data workflow (source of truth)

- `data/strains.json` — curated `{id, name, type, effects[], note?}` records.
- `data/lineage.json` — `{parent, child}` edges. **Edit these, then run
  `pnpm build:graph`.** Never hand-edit `public/graph.json`.
- `scripts/build-graph.ts` validates (dup ids, dangling refs, self-loops, dup
  edges, **cycle detection**), computes `generation` (longest path from root) and
  `descendants`, bakes color/size, runs ForceAtlas2, exports the graph.

## Architecture

- `app/lib/strains.ts` — shared types + constants.
- `app/lib/graph-utils.ts` — `computeFamily()` (ancestors ∪ self ∪ descendants).
- `app/lib/recommend.ts` — scoring: Jaccard effect overlap + undirected lineage
  proximity, with nearest-common-ancestor explanations. Renderer-agnostic.
- `app/lib/useStrainExplorer.ts` — **headless orchestration hook shared by both
  renderers.** Owns graph load, selection, type filters, recommendations, and the
  derived focus/relevant sets. Put shared interaction logic HERE so both views
  follow automatically.
- `app/components/StrainGraph.tsx` (2D) and `StrainGraph3D.tsx` (3D) are thin
  skins that map the hook's state to their draw API (Sigma reducers vs
  force-graph accessors). The panels (`graph/SearchPanel`, `DetailPanel`,
  `RecommendPanel`, `FilterLegend`) are shared and renderer-agnostic.
- Renderers are browser-only — loaded via `dynamic(..., { ssr: false })`.

## Gotchas

- **Sigma reserves the node `type` attribute** for the rendering-program name.
  Strain type is stored as `strainType` everywhere to avoid the collision.
- Sigma needs its node/edge programs registered explicitly (`nodeProgramClasses`
  / `edgeProgramClasses` in `SIGMA_SETTINGS`); implicit defaults didn't register.
- Custom dark hover renderer lives in `graph/drawHover.ts` (Sigma's default white
  box is illegible on the dark theme).

## The 3D view is experimental — maintained at checkpoints, NOT at parity

The 2D Sigma view (`/`) is canonical. The 3D view (`/3d`) is a deliberate "for
fun" extra and is **not** kept at feature parity. Iterate on it only at
meaningful checkpoints. Because shared logic lives in `useStrainExplorer` +
`recommend.ts` + the panels, most feature work flows to 3D for free; only touch
`StrainGraph3D.tsx` when deliberately syncing. Pin `three` /
`react-force-graph-3d` versions; `/3d` is code-split so three.js never loads on
the 2D path. **Do not treat 3D lagging behind 2D as a bug.**

## Status

Phases 0–3 complete: scaffold, curated data + build pipeline, explorer UX
(focus/search/filter/detail), and the recommender. Experimental 3D view merged.
See commit history (detailed messages) for the full arc.
