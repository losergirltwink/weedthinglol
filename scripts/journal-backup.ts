// `pnpm journal:export [file]`  — dump personal data from DATABASE_URL to JSON.
// `pnpm journal:import <file> [--replace]` — restore it (validated, atomic).
// Default DB: local PGlite. Against Neon, prefer DATABASE_URL_UNPOOLED.

import { readFileSync, writeFileSync } from "node:fs";

import { exportJournal, importJournal } from "../db/backup";
import { createDb, LOCAL_DATABASE_URL, migrateDb } from "../db/client";

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const file = rest.find((a) => !a.startsWith("--"));
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || LOCAL_DATABASE_URL;
  const handle = await createDb(url);
  try {
    if (url.startsWith("pglite://")) await migrateDb(handle, url);
    if (command === "export") {
      const out = file ?? `journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const data = await exportJournal(handle.db);
      writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
      console.log(
        `✓ exported ${data.journalEntries.length} sessions, ${data.wishlistItems.length} want-to-try, ` +
          `${data.personalStrains.length} personal strains → ${out}`,
      );
    } else if (command === "import" && file) {
      const n = await importJournal(handle.db, JSON.parse(readFileSync(file, "utf8")), {
        replace: rest.includes("--replace"),
      });
      console.log(`✓ imported ${n.journalEntries} sessions, ${n.wishlistItems} want-to-try, ${n.personalStrains} personal strains`);
    } else {
      console.error("Usage: journal-backup export [file] | import <file> [--replace]");
      process.exitCode = 2;
    }
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
