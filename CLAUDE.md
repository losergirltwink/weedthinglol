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
  *Multi-source* below), each compiled to its own baked graph file. The graph is
  static. Personal data (Phase 5) lives in Postgres and overlays it at view time.
- **Backend (Phase 5):** Postgres via **Drizzle** (Neon in prod; **PGlite**, an
  in-process WASM Postgres, locally + in tests) and **Better Auth** (passkeys +
  GitHub, single owner). Hosted on Vercel. See *Backend* below and
  `docs/deploy.md`.

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
  `all` union) and `generated/strain-catalog.json` from `data/<source>/`.** Run
  this after any data edit.
- `pnpm db:generate` — generate a migration from `db/schema.ts` into
  `db/migrations/` (never hand-edit generated SQL). `pnpm db:migrate` — apply
  them to `DATABASE_URL` (default local PGlite; reads `.env.local`).
  `pnpm check:migrations` — fail if the schema changed without a migration (CI).
- `pnpm promote <strainKey> [--dry-run]` — graduate a crowd or personal strain
  into `data/curated/` (appends the record + edges to curated parents; existing
  lines untouched; `lineageStatus: "reported"`, no citations). Then verify, add
  citations, `pnpm build:graph`. Candidates are ranked on `/queue`.
- `pnpm check:graph` — rebuild the graphs and **fail if `public/` or
  `generated/` changed** (the CI drift check). Run on a tree where `public/` is committed.
- `pnpm typecheck` (`tsc --noEmit`) · `pnpm lint` (`eslint app scripts data`) ·
  `pnpm test` (Vitest, `*.test.ts` next to the code; `pnpm test:watch`). There
  is no headless browser here, so verify via these + the dev log, not a real
  render.

## Branching & releases

- **`develop` is the base for all changes.** Branch off `develop`, PR back into
  `develop`. It's the integration/staging branch and tracks `origin/develop`.
  Default working branch.
- **`main` is release.** Promote to it only from `develop` (a release merge);
  never branch features off `main` or commit to it directly.
- **CI** (`.github/workflows/ci.yml`, PRs + pushes to `develop`/`main`):
  typecheck → lint → test → graph drift check → migration drift check →
  `next build` (with **no env/secrets**; the build must never need them). Actions are pinned
  by commit SHA; Dependabot (`.github/dependabot.yml`) bumps them and npm deps
  weekly against `develop` (three / react-force-graph-3d deliberately ignored).
  Next step: branch protection on `main` requiring the `check` job.
- **End-of-change checklist:** `pnpm build:graph` (if any `data/` or build code
  changed; never hand-edit `public/graph.*.json`) → `pnpm typecheck` →
  `pnpm lint` → `pnpm test` → skim the dev log, since there's no headless
  render. Commit messages end with the `Co-Authored-By` trailer.

## Data workflow (source of truth)

- `data/<source>/strains.json` — `{id, name, type, effects[], note?, citations?,
  lineageStatus?}` records;
  `data/<source>/lineage.json` — `{parent, child}` edges. The `curated` source is
  authored directly in this canonical shape. **Edit these, then run
  `pnpm build:graph`.** Never hand-edit any `public/graph.*.json`.
- `scripts/build-graph.ts` (thin driver) runs each registered source through its
  adapter, then `compile()` from `scripts/lib/compile.ts` (the pure, tested core,
  alongside `mergeSources` + `classifyNameKind`): validates (dup ids, **dup strainKeys**, citation urls, dangling
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

## Backend (Phase 5)

- **Env:** `app/lib/env.ts` validates with zod **lazily** (first `env()` call),
  never at import, because `next build` imports route modules without secrets.
  Nothing is required locally. Production requires the vars in `.env.example`.
- **DB:** `db/schema.ts` (source of truth) → `db/migrations/`. `db/client.ts`
  picks the driver from the URL (`postgres://` → node-postgres, `pglite://<dir>`
  or `pglite://memory` → PGlite). `db/index.ts` `getDb()` is the app accessor,
  and local PGlite auto-migrates on first connect. Tests use `freshDb()`
  (`test/db.ts`), a migrated in-memory DB.
- **Auth:** `app/lib/auth-config.ts` `makeAuth()` builds Better Auth.
  `app/lib/auth.ts` `getAuth()` is the lazy server instance and
  `app/lib/auth-client.ts` is the browser client; the route is
  `app/api/auth/[...all]`. The auth tables are hand-written in `db/schema.ts`,
  and `db/schema.test.ts` fails if a Better Auth upgrade expects fields we lack.
- **Single owner (security boundary):** only the GitHub account whose numeric id
  is `OWNER_GITHUB_ID` can ever get an account or a session
  (`app/lib/owner-gate.ts`, enforced in Better Auth DB hooks; a rejected sign-up
  rolls back via the adapter transaction). **Every mutation must start with
  `await requireOwner()`** (`app/lib/owner.ts`). Owner-only pages use
  `requireOwnerPage()`. Never rely on proxy/middleware or hidden UI for this.
- **Strain catalog:** `generated/strain-catalog.json` (built from the `all`
  union, keyed by `strainKey`, layout stripped, lineage as keys) is the
  server's view of strains. Read it via `app/lib/catalog.ts`. Strain pages render
  from it, and every write validates `strainKey` against it. Never hand-edit it.
- **Journal (5C):** `journal_entry` (the UI calls these "sessions"; the table name
  `session` is taken by auth) + `wishlist_item`. Ratings are stored as
  **half-star integers 1–10**. `consumed_on` is date-only (pseudonymity).
  Layers: `app/lib/journal/constants.ts` (dependency-free vocab, safe for client
  imports) → `input.ts` (zod; the only way writes are parsed; folds side-effects
  out of effects) → `queries.ts` (takes `db`; **visibility via
  `includePrivate` = `viewer.isOwner`, never a client flag**) → `actions.ts`
  (`"use server"`; every export starts with `await requireOwner()`, enforced by
  `app/lib/actions.test.ts`, which scans every `actions.ts`). Notes render as
  plain text, never HTML. Pages:
  `/strain/[key]` (public; noindex for non-curated), `/journal`,
  `/journal/new`, `/journal/[id]/edit`. The wishlist is shown publicly.
- **Personal strains (5C):** `personal_strain` (keyed by `strainKey` from the
  name; the key is immutable, so renames may only change spelling or
  capitalization). It's a fourth confidence tier, `personal`. Parents may be
  catalog or personal keys, and edits are cycle-checked. **Always resolve keys
  through `app/lib/strain-resolver.ts`** (`resolveStrain`, `strainExists`,
  `strainNames`, `strainOptions`). The catalog wins on collision; a promoted
  personal row becomes a stale shadow that `/queue` offers to delete. Deleting a
  live personal strain is refused while sessions, the wishlist or child strains
  reference it. Personal-strain notes are **owner-only** (they may reveal
  location). Pages: `/strains/new`, `/strains/[key]/edit`; `/strain/[key]`
  renders both kinds.
- **Promotion (5A.4):** `scripts/lib/promote.ts` `planPromotion` (pure) +
  `scripts/promote.ts` (I/O). `scripts/lib/curated-format.ts` `appendRows`
  preserves the curated files' hand formatting (tested byte-for-byte against the
  real files). `/queue` (owner) ranks candidates with `app/lib/promotion.ts`:
  tried ×10, wishlist +5, personal +3, curated relatives +2 each. Impersonal
  cross nodes are skipped.
- **Pseudonymity:** the `user` row holds GitHub name/email/avatar. Never render
  them on a public page. The public identity is `SITE_NAME` (`app/lib/site.ts`).
- **Dynamic vs static:** `getViewer()` reads `headers()` first, so any page using
  it is dynamic and never prerendered. The explorer pages stay static.
- `server-only` modules can't be imported by Vitest/tsx directly; Vitest aliases
  it to a stub. Keep testable logic in non-`server-only` modules (the
  `auth-config` / `owner-gate` / `db/client` split).

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
`strainKey` identity. Milestone 2 done: Vitest suites (strainKey, compile
validation/merge, recommender) + GitHub Actions CI + Dependabot. Milestone 3
done: Drizzle/Postgres (PGlite locally), Better Auth single-owner gate,
`/sign-in`, `/account` (passkeys), empty public `/journal`, security headers,
`docs/deploy.md`. The Vercel/Neon/OAuth dashboard setup is the owner's to do.
Milestone 4 done: journal sessions (create/edit/delete, ratings, effects,
context, flavors/terpenes, public/private), want-to-try list, public
`/strain/[key]` pages, server strain catalog, and a strain-page link from
`DetailPanel`. Milestone 5 done: personal strains + the promotion workflow
(`pnpm promote`, `/queue`).

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
