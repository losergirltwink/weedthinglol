// Test helper: a fresh, fully-migrated in-memory Postgres (PGlite) per call.
import { createDb, migrateDb, type DbHandle } from "@/db/client";

export async function freshDb(): Promise<DbHandle> {
  const url = "pglite://memory";
  const handle = await createDb(url);
  await migrateDb(handle, url);
  return handle;
}
