# Phase 4 — Source as a swappable axis

Make **data source** a first-class, modular dimension alongside the renderer
(2D/3D). Today the app has exactly one dataset (hand-curated) compiled to one
`public/graph.json`. Phase 4 generalizes that into N named sources, each with its
own confidence tier, selectable at runtime via a dropdown — *and* a union view
that visualizes them all together with provenance.

The guiding principle: **separate at rest, unified at view-time.** Sources are
stored and iterated in isolation; "all together" is just another build output.

## Data tiers (the denominations)

A confidence/coverage gradient. Stored independently; the union build merges them
with **curated-wins precedence** so verified records are never overwritten.

| id             | label                | confidence  | character                                                        |
| -------------- | -------------------- | ----------- | ---------------------------------------------------------------- |
| `curated`      | Curated              | `curated`   | today's data — hand-verified, lineage confirmed or flagged       |
| `expanded`     | Leafly (expanded)    | `documented`| broad scrape, structured, unverified — lineage "as reported"     |
| `full`         | Full / crowd         | `crowd`     | everything incl. sparse, contested, user-submitted (future tier) |
| `all`          | All sources          | —           | **union** of the above, provenance-tagged, own layout            |

## Architecture decisions (locked)

- **Switch model:** swap baked graphs. Each source compiles to its own
  `public/graph.<id>.json` with its own offline ForceAtlas2 bake. The runtime
  selector just re-fetches. Preserves zero-layout-in-browser for 2D.
- **Tier overlap:** independent at rest, cumulative at view. The `all` build
  merges sources; on any conflict (duplicate id, contradictory `strainType` or
  edge) **curated wins**, then `documented`, then `crowd`.
- **Phase scope:** ship the full abstraction proven with one small *sample*
  second source. Real Leafly ingestion is deferred.
- **Massaging discipline:** never hand-edit raw scraped data. A source keeps
  `raw/` (untouched, re-scrapeable) and `patch.json` (declared overrides); the
  adapter applies patch over raw. Hand-fixes stay a reviewable diff.

## Target layout

```
data/
  sources.ts              <- registry: [{ id, label, confidence }]  (shared build+client)
  curated/
    strains.json          <- moved from data/strains.json (unchanged content)
    lineage.json          <- moved from data/lineage.json
  expanded-demo/          <- SAMPLE source (~15 strains), proves the pipeline
    raw/leafly-sample.json
    patch.json            <- overrides layered over raw
scripts/
  adapters/
    types.ts              <- SourceAdapter contract
    curated.ts            <- identity: canonical JSON straight through
    leafly.ts             <- normalize raw + apply patch -> canonical (used by expanded-demo)
  build-graph.ts          <- loops sources -> per-source graphs + union
public/
  graph.curated.json
  graph.expanded-demo.json
  graph.all.json
```

`data/sources.ts` is the single registry, imported by both the build (to know
what to compile) and the client (to populate the dropdown). No generated
manifest.

## The adapter contract

```ts
// scripts/adapters/types.ts
import type { Strain, Lineage } from "@/app/lib/strains";

export interface SourceAdapter {
  id: string;                                  // matches a sources.ts entry
  load(): { strains: Strain[]; lineage: Lineage[] };
}
```

Once an adapter returns the canonical `{ strains, lineage }` shape, **everything
downstream is free**: validation, generation/descendant computation, layout bake,
`useStrainExplorer`, both renderers, every panel. This is the same leverage the
shared hook gives 2D/3D — define the contract once, new sources flow through.

`curated.ts` is the identity adapter (read the JSON, return it). `leafly.ts`
reads `raw/*.json`, normalizes field names/effect vocab to our schema, then
applies `patch.json` (add/drop/override records and edges) — the template real
Leafly ingestion will reuse.

## Build pipeline changes (`scripts/build-graph.ts`)

1. **Extract** the existing per-graph work (validate → derive `generation`/
   `descendants` → bake color/size → seed → ForceAtlas2 → export) into a pure
   `compile(strains, lineage, sourceTag) -> SerializedGraph`. No behavior change;
   just parameterized.
2. **Loop** registered sources: run each adapter, `compile(...)`, write
   `public/graph.<id>.json`. Stamp every node with `source` + `confidence`.
3. **Union:** merge all sources into one `{ strains, lineage }` with curated-wins
   precedence (dedup by id; first-writer-wins in confidence order; same applies
   to edges). `compile(...)` it with its own layout → `public/graph.all.json`.
4. Validation runs **per source** (a messy tier must not fail the curated build)
   and again on the union. Cycle detection still hard-fails everywhere.

Backward compat: drop bare `public/graph.json`; default source is `curated`.
Update the one fetch site (`useStrainExplorer`) accordingly.

## Type + provenance changes

- `app/lib/strains.ts`: add `confidence` type (`"curated" | "documented" |
  "crowd"`); extend `StrainNodeAttributes` with `source: string` and
  `confidence`. Authored `Strain` records stay unchanged — source/confidence are
  stamped at build time from the registry, not hand-authored per record.
- `data/sources.ts`: `export const SOURCES = [{ id, label, confidence }, ...]`
  plus a `DEFAULT_SOURCE` and the `all` pseudo-source.

## Runtime wiring (the shared part — both renderers inherit)

- **`app/lib/useStrainExplorer.ts`** gains `source`, `setSource`,
  `availableSources`. The load effect keys on `source` and fetches
  `/graph.${source}.json`. Changing source clears `selectedId` +
  recommendations. Because this hook already feeds both `StrainGraph` and
  `StrainGraph3D`, **source switching lands in 3D for free** — no
  `StrainGraph3D.tsx` edit required (consistent with the experimental-3D policy).
- **`app/components/graph/SourcePanel.tsx`** (new, renderer-agnostic): a small
  dropdown reading `availableSources` / `source` / `setSource`. Mount it in the
  right-hand column of `StrainGraph.tsx` (above `SearchPanel`); 3D picks it up at
  the next checkpoint sync.
- **Union affordances (v1, modest):** in the `all` view, `DetailPanel` shows a
  provenance badge (source + confidence); optionally dim `crowd`/`documented`
  nodes so the verified core stands out. Defer richer per-source coloring.

## Step order

1. Move `data/*.json` → `data/curated/`; add `data/sources.ts`.
2. Add `scripts/adapters/{types,curated}.ts`; refactor `build-graph.ts` to
   `compile()` + loop (curated only). Confirm `graph.curated.json` is
   byte-equivalent to old `graph.json` modulo the new `source` tag.
3. Add union build → `graph.all.json` with precedence merge.
4. Extend types (`source`/`confidence`); update `useStrainExplorer` fetch +
   source state; drop bare `graph.json`.
5. Add `SourcePanel`, mount in 2D.
6. Add `data/expanded-demo/` (raw + patch) and `leafly.ts` adapter; register it;
   rebuild.
7. `DetailPanel` provenance badge + union dimming.
8. Update `CLAUDE.md` Status to "Phase 4 complete"; refresh Data workflow +
   Architecture sections.

## Verification (no headless browser here)

- `pnpm build:graph` emits all `graph.<id>.json` + `graph.all.json`; per-source
  validation passes, union has no cycles.
- `pnpm exec tsc --noEmit` and `pnpm lint` clean.
- `pnpm dev`; switch the dropdown; confirm `.next/dev/logs/next-development.log`
  is error-free and the graph re-fetches on source change.

## Out of scope (later)

- Real Leafly acquisition (dump vs live scrape — Leafly ToS restricts scraping;
  prefer a static export). The `leafly.ts` adapter + raw/patch pattern is the
  seam it will plug into.
- The `full`/crowd tier dataset.
- Per-source color theming / a provenance legend toggle beyond v1 dimming.
- 3D `SourcePanel` mount (next 3D checkpoint).
```
