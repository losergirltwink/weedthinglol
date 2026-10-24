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
- **Layout:** ForceAtlas2 baked **offline** into `public/graph.<source>.json`;
  the 2D browser does zero layout. (The 3D view lays out live in-browser.)
- **Data:** multiple static-JSON **sources** on a confidence gradient (see
  *Multi-source* below), each compiled to its own baked graph file. No backend,
  no DB. All state is transient client state.

## Package manager: pnpm

This is a pnpm project (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). **Use pnpm, not
npm.** Native build deps (sharp, unrs-resolver, esbuild) must stay `true` under
`allowBuilds:` in `pnpm-workspace.yaml`, or `pnpm install` exits 1 and breaks
`next build`'s dependency check.

## Commands

- `pnpm dev` — dev server (port 3000). Browser console errors are captured in
  `.next/dev/logs/next-development.log` — useful since the renderers are
  client-only and won't surface via `curl`.
- `pnpm stop` — kill a running dev server (the `next dev` / `next-server` /
  worker tree). For a server started detached/in the background with no terminal
  to `Ctrl-C`; no-op (friendly message, exits 0) when nothing is running. Uses
  the `[n]ext` bracket trick so `pkill` doesn't match its own command line.
- `pnpm build` — production build / typecheck.
- `pnpm build:graph` — **regenerate every `public/graph.<source>.json` (+ the
  `all` union) from `data/<source>/`.** Run this after any data edit.
- `pnpm exec tsc --noEmit` — typecheck. There is no headless browser here, so
  verify via tsc + eslint + the dev log, not a real render.

## Branching & releases

- **`develop` is the base for all changes.** Branch off `develop`, PR back into
  `develop`. It's the integration/staging branch and tracks `origin/develop`.
  Default working branch.
- **`main` is release.** Promote to it only from `develop` (a release merge);
  never branch features off `main` or commit to it directly. A CI/CD pipeline on
  `main` is planned but not wired yet, so this is convention for now, not
  enforcement — branch protection on `main` is the natural next step once CI
  exists.
- **End-of-change checklist:** `pnpm build:graph` (if any `data/` or build code
  changed; never hand-edit `public/graph.*.json`) → `pnpm exec tsc --noEmit` →
  `pnpm exec eslint app scripts data` → skim the dev log, since there's no
  headless render. Commit messages end with the `Co-Authored-By` trailer.

## Data workflow (source of truth)

- `data/<source>/strains.json` — `{id, name, type, effects[], note?, citations?,
  lineageStatus?}` records;
  `data/<source>/lineage.json` — `{parent, child}` edges. The `curated` source is
  authored directly in this canonical shape. **Edit these, then run
  `pnpm build:graph`.** Never hand-edit any `public/graph.*.json`.
- `scripts/build-graph.ts` runs each registered source through its adapter, then
  `compile()`: validates (dup ids, **dup strainKeys**, citation urls, dangling
  refs, self-loops, dup edges, **cycle detection** — per source) → computes
  `generation` + `descendants` → bakes color/size/**provenance**/**entity-kind**/
  `strainKey` → ForceAtlas2 → exports
  `public/graph.<source>.json`. It also builds the `all` union (see below).
- **Stable identity (`strainKey`):** `app/lib/strain-key.ts` derives a URL-safe
  key from the strain NAME (`"Skunk #1"` → `skunk-no1`; `+` stays significant,
  so Critical ≠ Critical+). It's baked onto every node and is THE identity: the
  kushy de-dup, the union merge, and anything persisted (reviews, wishlist,
  `/strain/[key]` URLs — Phase 5) all use it, never the source-namespaced node id.
  Unique per graph (build error otherwise).
- **Citations + lineage status (curated):** `citations: {label, url}[]` (http(s)
  only, rendered as links) and `lineageStatus: confirmed | reported | disputed`,
  shown in `DetailPanel`. Missing citations on curated records are a build
  **warning** during the backfill; the plan is to make them an error. Never invent
  a citation — only add sources you've actually checked.
- **Effect partition:** `compile()` splits each strain's `effects` against
  `NEGATIVE_EFFECTS` (strains.ts) into desirable `effects` + side-effect
  `negatives` (e.g. dry mouth, paranoid). Source-agnostic — curated has no
  negatives; crowd data mixes both in one list. This keeps effect-similarity from
  matching on shared side-effects and feeds the recommender's avoid-penalty +
  `DetailPanel`'s "May cause" group. Add new side-effects to `NEGATIVE_EFFECTS`.
- **Entity-kind (`nameKind`):** `compile()` classifies each node `named` vs
  `cross` (`classifyNameKind`). A `cross`-expression is a node whose NAME is a
  cross formula (`A x B`, split on the shared `CROSS_SPLIT` from the kushy adapter)
  **and** whose parents structurally corroborate it (in-degree ≥ component count)
  — connective tissue between parents we already have, not a named cultivar.
  Requiring corroboration ("approach 2") is also a precision guard: it refuses to
  tag parse-noise like `XXX OG (Triple X OG)`. Curated names are never cross-
  shaped, so curated is always `named`. Drives the recommender's cross
  down-weight + a subtle 2D resting de-emphasis (cross nodes shrink + drop their
  label at rest, lifted on select/hover). The build logs `entity-kind: tagged /
  cross-shaped (stragglers)` per graph.

## Multi-source (Phase 4)

Data **source** is a swappable axis, sibling to the 2D/3D renderer axis.
Principle: **separate at rest, unified at view-time.**

- **Registry:** `data/sources.ts` — the single list of sources (`{id, label,
  confidence, dir}`), ordered by trust. Imported by **both** the build and the
  client (`AVAILABLE_SOURCES` feeds the dropdown). Add a source here.
- **Adapters** (`scripts/adapters/`): the `SourceAdapter` contract is the
  standardized input point — `load()` returns canonical `{strains, lineage}`, and
  everything downstream is free. `curated.ts` is identity; `kushy.ts`
  (`makeKushyAdapter(id, dir)`) is the live crowd adapter — it parses the kushy
  CSV scrape, **recovers lineage encoded in strain names** (`"A x B"` → edges to
  the existing A and B rows), and **de-dups strain identity** (exact-name
  collisions auto-merge; declared aliases fold abbreviations like `Sour D` →
  `Sour Diesel`) before its patch, keeping the result a DAG by construction.
  `leafly.ts` (`makeLeaflyAdapter`) remains as a reference Leafly-shaped seam.
- **Publishable facts only:** the site is going public, so a scraped source ships
  only factual fields (name, type, lineage, effect tags). Kushy's `description`
  column (near-verbatim commercial prose) is deliberately dropped in the adapter.
  Every `SourceDef` carries an `attribution` string, shown with provenance.
- **Massaging discipline:** a scraped source keeps `data/<id>/raw/` (never
  hand-edited, re-scrapeable) + `data/<id>/patch.json` (declared
  drop/override/add/**alias** ops). Hand-fixes stay a reviewable diff. Identity
  principle: a **node is an identity, an edge is kinship** — merge same-strain
  spellings, never merge distinct-but-related strains (NYC Diesel ≠ Sour Diesel).
  See `data/kushy/` for the worked example (the crowd source).
- **Union (`all`):** `mergeSources()` folds sources in trust order with
  **curated-wins precedence**, matching identity by **`strainKey`** (the same
  key the kushy de-dup uses) — sources have disjoint id namespaces, so a
  strain in two sources is the same identity under two ids. The higher-trust node
  is kept verbatim (its `strainType`/effects/tier stay — curated Sour Diesel
  stays a sativa) and the lower-trust source's **edges are re-pointed** onto it,
  so community lineage attaches to the verified core instead of a shadow
  duplicate. Edges go in through a reachability guard (folding can imply a cycle
  present in neither source). Each surviving node keeps its true origin; output is
  `public/graph.all.json`, shown in the dropdown only once >1 source exists.
- **Provenance:** every node carries `source` + `confidence`. `DetailPanel` shows
  a badge for non-curated nodes; the 2D union view mutes non-curated nodes at
  rest (`GraphController` `dimLowConfidence`) so the verified core dominates. The
  `ProvenanceLegend` (2D, bottom-left) keys the confidence tiers and explains the
  two visual channels (hue = strain type, brightness/size = confidence); it
  auto-hides unless the loaded graph mixes tiers (i.e. the union).
- Full design notes: `docs/phase-4-plan.md`.

## Architecture

- `app/lib/strains.ts` — shared types + constants (incl. `Confidence`,
  `TYPE_COLORS`, `CONFIDENCE_META`, `NEGATIVE_EFFECTS`).
- `data/sources.ts` — source registry shared by build + client (see *Multi-source*).
- `app/lib/graph-utils.ts` — `computeFamily()` (ancestors ∪ self ∪ descendants).
- `app/lib/recommend.ts` — scoring: Jaccard overlap of **desirable** effects +
  undirected lineage proximity + a gentle same-`strainType` nudge, minus
  side-effect penalties (explicitly-avoided effects hit hard; side-effects a
  candidate adds beyond the seed's hit gently) and a gentle **cross-expression
  down-weight** (a `cross` node is connective tissue, not a strain to seek out).
  Explanations carry shared-effect count, nearest common ancestor, hop distance,
  and the driving signal. Renderer-agnostic.
- `app/lib/useStrainExplorer.ts` — **headless orchestration hook shared by both
  renderers.** Owns the active **source** (fetches `/graph.<source>.json`),
  graph load, selection, type filters, recommendations, and the derived
  focus/relevant sets. Put shared interaction logic HERE so both views follow
  automatically.
- `app/components/StrainGraph.tsx` (2D) and `StrainGraph3D.tsx` (3D) are thin
  skins that map the hook's state to their draw API (Sigma reducers vs
  force-graph accessors). The panels (`graph/SourcePanel`, `SearchPanel`,
  `DetailPanel`, `RecommendPanel`, `FilterLegend`) are shared and
  renderer-agnostic.
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

Phases 0–4 complete: scaffold, curated data + build pipeline, explorer UX
(focus/search/filter/detail), the recommender, experimental 3D view, and
**multi-source** (swappable data sources + `all` union with provenance; see
*Multi-source* above and `docs/phase-4-plan.md`). See commit history (detailed
messages) for the full arc.

**Phase 5 (in progress)** — personal strain journal + public site; plan in
`docs/phase-5-plan.md`. Milestone 1 (data trust) done: kushy prose stripped +
relabeled "Unverified (2017 community)", citations/lineage-status schema,
`strainKey` identity.

Phase 4 follow-ups: the **`crowd` tier is live** — `kushy` (a ~9.5k-strain
community CSV scrape) compiles to a 1.2k-node connected lineage graph via
name-mining + identity de-dup; it replaced the old `expanded-demo` sample. The **provenance legend** is also
done (`ProvenanceLegend`, see above). The 3D view now mounts `SourcePanel` too
(deliberate 3D checkpoint sync — source switching already worked via the shared
hook; this added the dropdown UI). Still open: graduated per-tier dimming (the
current resting-dim is binary curated-vs-rest — fine for two tiers, worth revisiting if a middle
`documented` tier returns); a higher-fidelity `documented`-tier source (kushy's
`crosses` column is sparse; the seam is proven if a better dump appears).

Data-quality + recommender pass (post-Phase-4, merged to `main` as PR #2):
effects are partitioned into desirable vs `negatives` (see *Data workflow*); the
recommender gained type affinity, an avoid-penalty for side-effects, and richer
"why" explanations. A new **entity-kind axis** (`nameKind`) classifies named
cultivars vs `cross`-expression nodes — orthogonal to the trust/provenance axis —
driving a gentle recommender down-weight + a subtle 2D resting de-emphasis (see
*Entity-kind* under *Data workflow*; 435/1224 union nodes are `cross`).
Cross-source identity is reconciled by name at union time (see *Multi-source*).

**Deferred enhancement — curated improvements & source reviews:** thickening the
curated tier is intentionally a *separate, later* effort. Two flavors when we pick
it up: (1) **hand-author** new curated records for high-traffic strains currently
missing or crowd-only; (2) a **review** workflow — promote/correct crowd strains
into curated (right type, verified lineage), turning the crowd tier into a
candidate queue. Both flow through `data/curated/*.json` + `pnpm build:graph`; no
new machinery needed. Until then this round was **massage-only** (no new
hand-authored strains).
