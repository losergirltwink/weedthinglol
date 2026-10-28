// Guards the hand-written auth schema against Better Auth upgrades: every model
// and field Better Auth expects (for our plugin set) must exist in db/schema.ts.

import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { getTableColumns, type Table } from "drizzle-orm";
import { getAuthTables } from "better-auth/db";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

describe("auth schema parity with Better Auth", () => {
  const expected = getAuthTables({
    plugins: [passkeyPlugin()],
    rateLimit: { storage: "database" },
  } as Parameters<typeof getAuthTables>[0]);

  for (const [model, def] of Object.entries(expected)) {
    it(`has every field of "${model}"`, () => {
      const table = (schema as Record<string, unknown>)[def.modelName] as Table | undefined;
      expect(table, `missing table export "${def.modelName}"`).toBeDefined();
      const columns = Object.keys(getTableColumns(table!));
      expect(columns).toContain("id");
      for (const field of Object.keys(def.fields)) expect(columns).toContain(field);
    });
  }
});
