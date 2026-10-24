// App-side database accessor: one lazily-created connection per server process
// (cached on globalThis so dev hot-reloads don't leak pools / reopen PGlite).

import "server-only";

import { env } from "@/app/lib/env";
import { createDb, migrateDb, type Db, type DbHandle } from "./client";

const g = globalThis as unknown as { __db?: Promise<DbHandle> };

async function connect(url: string): Promise<DbHandle> {
  const handle = await createDb(url);
  // Local PGlite migrates itself so a fresh clone just works with `pnpm dev`.
  // Real Postgres is migrated explicitly (`pnpm db:migrate`, part of the deploy).
  if (url.startsWith("pglite://")) await migrateDb(handle, url);
  return handle;
}

export async function getDb(): Promise<Db> {
  g.__db ??= connect(env().DATABASE_URL);
  return (await g.__db).db;
}
