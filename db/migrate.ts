// `pnpm db:migrate` — apply pending migrations to DATABASE_URL (default: the
// local PGlite database). In production this runs as part of the Vercel build
// command, against that deployment's own Neon branch (docs/deploy.md).

import { createDb, LOCAL_DATABASE_URL, migrateDb } from "./client";

// Prefer the direct (unpooled) connection for DDL: Neon's pooled URL goes through
// PgBouncer in transaction mode. The Neon↔Vercel integration sets both.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || LOCAL_DATABASE_URL;
const target = url.startsWith("pglite://") ? url : url.replace(/\/\/[^@]*@/, "//***@");

async function main() {
  const handle = await createDb(url);
  try {
    await migrateDb(handle, url);
    console.log(`✓ migrations applied to ${target}`);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
