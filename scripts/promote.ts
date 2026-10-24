// `pnpm promote <strainKey> [--dry-run]` — graduate a crowd (kushy) or personal
// strain into data/curated/. Appends the record + edges (existing lines are
// untouched), then you verify it, add citations, and run `pnpm build:graph`.
// Personal strains are read from DATABASE_URL (default: local PGlite).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPersonalStrain } from "../app/lib/personal/queries";
import type { Catalog, Lineage, Strain } from "../app/lib/strains";
import { createDb, LOCAL_DATABASE_URL, migrateDb } from "../db/client";
import { appendRows } from "./lib/curated-format";
import { planPromotion, type PromotionSource } from "./lib/promote";

const ROOT = process.cwd();
const paths = {
  strains: resolve(ROOT, "data/curated/strains.json"),
  lineage: resolve(ROOT, "data/curated/lineage.json"),
  catalog: resolve(ROOT, "generated/strain-catalog.json"),
};

async function findSource(key: string): Promise<PromotionSource | string> {
  const catalog = JSON.parse(readFileSync(paths.catalog, "utf8")) as Catalog;
  const entry = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  if (entry?.confidence === "curated") return `"${entry.name}" is already curated.`;
  if (entry) {
    return {
      key,
      name: entry.name,
      strainType: entry.strainType,
      effects: entry.effects,
      parents: entry.parents,
      origin: "crowd",
    };
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || LOCAL_DATABASE_URL;
  const handle = await createDb(url);
  try {
    // Local PGlite may predate the latest migration (the app migrates it on
    // connect; do the same here). Real Postgres is migrated by the deploy.
    if (url.startsWith("pglite://")) await migrateDb(handle, url);
    const p = await getPersonalStrain(handle.db, key);
    if (!p) return `No strain with key "${key}" in the catalog or personal strains.`;
    return { key, name: p.name, strainType: p.strainType, effects: [], parents: p.parentKeys, origin: "personal" };
  } finally {
    await handle.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const key = args.find((a) => !a.startsWith("--"));
  if (!key) {
    console.error("Usage: pnpm promote <strainKey> [--dry-run]");
    process.exit(2);
  }

  const source = await findSource(key);
  if (typeof source === "string") {
    console.error(`✗ ${source}`);
    process.exit(1);
  }

  const strainsText = readFileSync(paths.strains, "utf8");
  const lineageText = readFileSync(paths.lineage, "utf8");
  const plan = planPromotion(source, JSON.parse(strainsText) as Strain[]);
  if (!plan.ok) {
    console.error(`✗ ${plan.error}`);
    process.exit(1);
  }

  console.log(`Promote "${source.name}" (${source.origin}) → curated id "${plan.record.id}"`);
  console.log(`  record: ${JSON.stringify(plan.record)}`);
  for (const e of plan.edges) console.log(`  edge:   ${e.parent} → ${e.child}`);
  if (plan.missingParents.length) {
    console.log(`  ⚠ parents not curated yet (no edge added): ${plan.missingParents.join(", ")}`);
    console.log(`    promote them first, e.g. pnpm promote ${plan.missingParents[0]}`);
  }
  if (dryRun) {
    console.log("(dry run — nothing written)");
    return;
  }

  writeFileSync(paths.strains, appendRows(strainsText, [plan.record]));
  writeFileSync(paths.lineage, appendRows(lineageText, plan.edges satisfies Lineage[]));
  console.log("✓ appended to data/curated/. Next:");
  console.log("  1. Verify type/effects/parents; add citations and set lineageStatus.");
  console.log("  2. pnpm build:graph");
  if (source.origin === "personal") {
    console.log("  3. After deploying, delete the stale personal copy from /queue.");
  }
}

main().catch((err) => {
  console.error("✗ promote failed:", err);
  process.exit(1);
});
