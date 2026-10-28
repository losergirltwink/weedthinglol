/**
 * build-graph.ts — compiles each registered source into public/graph.<id>.json.
 *
 * Per source (scripts/adapters/* -> data/sources.ts registry):
 *   1. Load canonical { strains, lineage } via the source's adapter
 *   2. Validate (duplicate ids/strainKeys, citations, dangling refs, self-loops, cycles)
 *   3. Compute derived fields: generation depth + descendant count
 *   4. Bake presentation attributes (label, color, size) + provenance tags
 *   5. Run ForceAtlas2 layout offline (deterministic seed)
 *   6. Export a Graphology-serialized graph the client imports as-is
 *   7. From the union, also emit generated/strain-catalog.json (server-side)
 *
 * Validation runs per source: a messy tier must not fail the curated build.
 * The compile core (validation, derived fields, layout, union merge) lives in
 * scripts/lib/compile.ts; this file only loads sources and writes outputs.
 * Run with: pnpm build:graph
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { Strain, Lineage } from "../app/lib/strains";
import { SOURCES, ALL_SOURCE } from "../data/sources";
import { adapterFor } from "./adapters";
import { buildCatalog, compile, mergeSources, serializeCatalog, type Provenance } from "./lib/compile";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Drive every registered source plus the union; collect failures, exit once.
// ---------------------------------------------------------------------------
mkdirSync(resolve(ROOT, "public"), { recursive: true });
mkdirSync(resolve(ROOT, "generated"), { recursive: true });

const allErrors: string[] = [];

/**
 * Compile + write public/graph.<outId>.json, accumulating validation errors.
 * With `catalog`, also writes generated/strain-catalog.json from this graph.
 */
function emit(
  outId: string,
  strains: Strain[],
  lineage: Lineage[],
  provenanceFor: (id: string) => Provenance,
  catalog = false,
): void {
  const { graph, errors, maxGen } = compile(strains, lineage, provenanceFor);

  if (errors.length) {
    allErrors.push(`[${outId}] ${errors.length} error(s):`);
    for (const e of errors) allErrors.push(`  - ${e}`);
    return;
  }

  const serialized = JSON.stringify(graph.export(), null, 2);
  writeFileSync(resolve(ROOT, `public/graph.${outId}.json`), serialized);
  console.log(
    `✓ graph.${outId}.json — ${graph.order} strains, ${graph.size} lineage edges, max depth ${maxGen}.`,
  );

  if (catalog) {
    writeFileSync(resolve(ROOT, "generated/strain-catalog.json"), serializeCatalog(buildCatalog(graph)));
    console.log(`✓ generated/strain-catalog.json — ${graph.order} entries.`);
  }
}

// Per-source builds (uniform provenance — every node is from this source).
for (const source of SOURCES) {
  const { strains, lineage } = adapterFor(source.id).load();
  emit(source.id, strains, lineage, () => ({ source: source.id, confidence: source.confidence }));
}

// Union build (per-node provenance from the merge; validated again, incl. cycles).
{
  const inputs = SOURCES.map((src) => ({ src, data: adapterFor(src.id).load() }));
  const { strains, lineage, origin } = mergeSources(inputs);
  // The union is the catalog: every strain from every source, curated-wins.
  emit(ALL_SOURCE.id, strains, lineage, (id) => origin.get(id)!, true);
}

if (allErrors.length) {
  console.error(`\n✗ Validation failed:`);
  for (const e of allErrors) console.error(e);
  process.exit(1);
}
