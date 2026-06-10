// Curated source adapter — identity. The curated data is already in canonical
// shape, so `load()` just reads data/curated/*.json straight through.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Strain, Lineage } from "@/app/lib/strains";
import type { SourceAdapter, SourceData } from "./types";

const read = <T>(rel: string): T =>
  JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8")) as T;

export const curatedAdapter: SourceAdapter = {
  id: "curated",
  load: (): SourceData => ({
    strains: read<Strain[]>("data/curated/strains.json"),
    lineage: read<Lineage[]>("data/curated/lineage.json"),
  }),
};
