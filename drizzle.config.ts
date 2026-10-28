// drizzle-kit config — used only to GENERATE migrations from db/schema.ts
// (`pnpm db:generate`); applying them is db/migrate.ts.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
});
