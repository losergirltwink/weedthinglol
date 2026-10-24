// Database connection factory, shared by the app (db/index.ts), the migration
// script, and tests. Picks the driver from the URL scheme:
//   postgres://…    → node-postgres pool (Neon in production)
//   pglite://<dir>  → PGlite, Postgres compiled to WASM, in-process — zero-setup
//                     local dev; `pglite://memory` is an ephemeral in-memory DB.
// Drivers are imported dynamically so production never loads PGlite.
//
// Deliberately NOT `server-only`: plain Node scripts and Vitest import it too.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

/** Default local database (gitignored `.data/`). */
export const LOCAL_DATABASE_URL = "pglite://.data/pglite";

const MIGRATIONS_FOLDER = resolve(process.cwd(), "db/migrations");

const pgliteDir = (url: string): string | undefined => {
  const dir = url.slice("pglite://".length);
  return dir && dir !== "memory" ? dir : undefined; // undefined → in-memory
};

export async function createDb(url: string): Promise<DbHandle> {
  if (url.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = pgliteDir(url);
    if (dir) mkdirSync(dirname(resolve(dir)), { recursive: true }); // PGlite won't create parents
    const client = new PGlite(dir);
    // The PGlite and node-postgres drizzle databases share the same query API;
    // typing both as `Db` keeps call sites driver-agnostic.
    return { db: drizzle(client, { schema }) as unknown as Db, close: () => client.close() };
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

/** Apply every pending migration in db/migrations to the database at `url`. */
export async function migrateDb(handle: DbHandle, url: string): Promise<void> {
  if (url.startsWith("pglite://")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}
