// Adapter registry — maps a source id to its SourceAdapter. The build pairs each
// SourceDef in data/sources.ts with the adapter of the same id. New sources
// register here (e.g. the leafly adapter in a later Phase 4 step).

import type { SourceAdapter } from "./types";
import { curatedAdapter } from "./curated";

const ADAPTERS: Record<string, SourceAdapter> = {
  [curatedAdapter.id]: curatedAdapter,
};

export function adapterFor(id: string): SourceAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`No adapter registered for source "${id}"`);
  return adapter;
}
