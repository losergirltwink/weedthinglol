// Kushy community-dataset adapter — normalizes the 2017 kushy strains CSV
// (data/<dir>/raw/) into canonical records, then applies a hand-authored patch.
//
// Kushy is a CROWD-tier scrape, and the rawness shows: ~94% of rows are isolated
// (no crosses), the numeric `crosses` column is full of dangling refs and a "0"
// placeholder, and `type` carries some truncated garbage ("Organi", "Inorga").
// This adapter does deterministic STRUCTURAL cleanup only — parse, normalize,
// drop dangling/self/dup edges. Semantic hand-fixes (a wrong type, a bogus
// cross) belong in patch.json so they stay a reviewable diff over the raw scrape.
//
// Raw CSV columns (quoted, NULL/empty for missing):
//   id, status, sort, name, slug, image, description, type, crosses, breeder,
//   effects, ailment, flavor, location, terpenes, thc, ...cannabinoids
// `crosses` is a comma-list of numeric ids referencing OTHER rows = the lineage.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { STRAIN_TYPES, type Strain, type StrainType, type Lineage } from "@/app/lib/strains";
import type { SourceAdapter, SourceData } from "./types";

interface Patch {
  dropStrains?: string[];
  dropEdges?: Lineage[];
  overrideStrains?: Array<Partial<Strain> & { id: string }>;
  addStrains?: Strain[];
  addEdges?: Lineage[];
  /**
   * Declared identity merges for abbreviations/spellings that DON'T normalize
   * equal, keyed by name: { "Sour D": "Sour Diesel" }. The alias strain is folded
   * INTO the canonical one (its node dropped, its edges + name-references
   * redirected). Exact-normalized duplicates ("NYC Diesel" ×2) merge
   * automatically and need no entry. NEVER list distinct-but-related strains here
   * (NYC Diesel is not Sour Diesel) — that's what lineage edges are for.
   */
  aliases?: Record<string, string>;
}

const TYPE_SET = new Set<string>(STRAIN_TYPES);

/** Coerce a scraped type string to a StrainType; unknowns/garbage fall back. */
const normalizeType = (raw: string): StrainType => {
  const t = raw.trim().toLowerCase();
  return (TYPE_SET.has(t) ? t : "hybrid") as StrainType;
};

// kushy ids are bare integers and `crosses` references them by that integer;
// prefix so they never collide with curated slug ids in the union (a strain in
// both sources stays two distinct nodes — reconciling by name is out of scope).
const nodeId = (rawId: string) => `kushy-${rawId}`;

const NULLISH = new Set(["", "NULL"]);
const clean = (v: string | undefined) => (v == null || NULLISH.has(v) ? "" : v);

/** Strip the HTML wrapping kushy descriptions down to a plain-text note. */
const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

// Fold the common naming inconsistencies so "Skunk No.1", "Skunk #1" and
// "Skunk No. 1" all key to one canonical form for name->id resolution.
const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/#\s*/g, "no") // "#1" / "# 1" -> "no1"
    .replace(/\bno\.?\s*/g, "no") // "no. 1" / "no 1" -> "no1"
    .replace(/['".,()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Delimiters that denote a CROSS inside a strain name: "A x B", "A × B",
// "A / B". Note: " by " is deliberately excluded — "Super Glue by NOTA" names a
// breeder, not a parent. The x/× forms require surrounding whitespace so we
// never split mid-word (e.g. "Maxx").
const CROSS_SPLIT = /\s+[x×]\s+|\s*\/\s*/i;

/** Minimal RFC4180 parser: quoted fields, "" escapes, embedded commas/newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++; // escaped quote
        else { inQuotes = false; continue; }
      }
      field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // ignore — handled by the \n branch
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Build an adapter for a kushy-CSV-shaped source rooted at data/<dir>/. */
export function makeKushyAdapter(id: string, dir: string): SourceAdapter {
  return {
    id,
    load: (): SourceData => {
      const csvPath = resolve(process.cwd(), `data/${dir}/raw/strains-kushy_api.2017-11-14.csv`);
      const [header, ...rows] = parseCsv(readFileSync(csvPath, "utf8"));
      const col = Object.fromEntries(header.map((h, i) => [h, i] as const));
      const get = (r: string[], name: string) => clean(r[col[name]]);

      // 1. Normalize raw -> canonical strains, collecting the `crosses`-column
      // edges (the authoritative, if sparse, lineage signal).
      const strainById = new Map<string, Strain>();
      const crossEdges: Lineage[] = [];
      for (const r of rows) {
        const rawId = get(r, "id");
        if (!rawId) continue; // skip blank trailing rows
        const childId = nodeId(rawId);
        const effects = get(r, "effects")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const note = stripHtml(get(r, "description"));
        strainById.set(childId, {
          id: childId,
          name: get(r, "name") || rawId,
          type: normalizeType(get(r, "type")),
          ...(effects.length ? { effects } : {}),
          ...(note ? { note } : {}),
        });
        for (const c of get(r, "crosses").split(",")) {
          const p = c.trim();
          if (p && p !== "0") crossEdges.push({ parent: nodeId(p), child: childId });
        }
      }

      // 2. Apply patch over raw (the only place semantic hand-fixes live).
      const patchPath = resolve(process.cwd(), `data/${dir}/patch.json`);
      const patch: Patch = existsSync(patchPath)
        ? (JSON.parse(readFileSync(patchPath, "utf8")) as Patch)
        : {};
      if (patch.dropStrains?.length) {
        const dropped = new Set(patch.dropStrains);
        for (const sid of dropped) strainById.delete(sid);
      }
      for (const ov of patch.overrideStrains ?? []) {
        const base = strainById.get(ov.id);
        if (base) strainById.set(ov.id, { ...base, ...ov });
      }
      for (const s of patch.addStrains ?? []) strainById.set(s.id, s);

      // 3. Canonicalize identity. The same strain often appears as several rows
      // — exact-name duplicates ("NYC Diesel" ×2) and abbreviations that don't
      // normalize equal ("Sour D" vs "Sour Diesel"). Left alone, a strain's
      // children scatter across its duplicate nodes. We pick ONE canonical id per
      // identity (lowest id, the oldest row) and redirect the rest onto it.
      // Distinct-but-related strains (NYC Diesel ≠ Sour Diesel) are NOT merged —
      // only true same-strain aliases, and the declared ones stay a patch diff.
      const idNum = (nid: string) => Number(nid.slice("kushy-".length));
      const repByNorm = new Map<string, string>(); // normalized name -> lowest-id node
      for (const s of strainById.values()) {
        const key = normalizeName(s.name);
        const cur = repByNorm.get(key);
        if (!cur || idNum(s.id) < idNum(cur)) repByNorm.set(key, s.id);
      }
      // Declared aliases fold one identity's representative into another's.
      const aliasRedirect = new Map<string, string>(); // rep id -> canonical rep id
      const nameAliasIndex = new Map<string, string>(); // norm(aliasName) -> canonical id
      const follow = (x: string): string => {
        const seen = new Set<string>();
        while (aliasRedirect.has(x) && !seen.has(x)) {
          seen.add(x);
          x = aliasRedirect.get(x)!;
        }
        return x;
      };
      for (const [aName, cName] of Object.entries(patch.aliases ?? {})) {
        const cRep = repByNorm.get(normalizeName(cName));
        if (!cRep) {
          console.warn(`  ↳ kushy alias: canonical "${cName}" not found — skipping "${aName}".`);
          continue;
        }
        const cCanon = follow(cRep);
        const aRep = repByNorm.get(normalizeName(aName));
        if (aRep && follow(aRep) !== cCanon) aliasRedirect.set(follow(aRep), cCanon);
        nameAliasIndex.set(normalizeName(aName), cCanon); // also resolves abbrevs in cross-names
      }
      const canon = (nid: string): string => {
        const rep = repByNorm.get(normalizeName(strainById.get(nid)?.name ?? ""));
        return rep ? follow(rep) : nid; // dangling ids (no row) pass through to be dropped
      };

      // 4. Collapse each identity to one record, unioning the duplicates'
      // effects and keeping the first note. Only the canonical node survives.
      const canonStrains = new Map<string, Strain>();
      for (const s of strainById.values()) {
        if (canon(s.id) === s.id) {
          canonStrains.set(s.id, { ...s, ...(s.effects ? { effects: [...s.effects] } : {}) });
        }
      }
      for (const s of strainById.values()) {
        const c = canon(s.id);
        if (c === s.id) continue;
        const base = canonStrains.get(c);
        if (!base) continue;
        if (s.effects?.length) base.effects = [...new Set([...(base.effects ?? []), ...s.effects])];
        if (!base.note && s.note) base.note = s.note;
      }

      // 5. Recover lineage encoded in the NAMES. Most kushy crosses live in the
      // name ("Mango x Trainwreck"), not the `crosses` column, and both sides
      // usually exist as their own rows. Resolve each side to a CANONICAL id —
      // via the declared alias index first ("Sour D" -> Sour Diesel), then the
      // normalized-name index. This is the bulk of the source's real lineage.
      const idByName = new Map<string, string>();
      for (const s of canonStrains.values()) {
        const key = normalizeName(s.name);
        if (!idByName.has(key)) idByName.set(key, s.id);
      }
      const resolveComponent = (part: string): string | undefined => {
        const key = normalizeName(part);
        return nameAliasIndex.get(key) ?? idByName.get(key);
      };
      const nameEdges: Lineage[] = [];
      for (const s of canonStrains.values()) {
        const parts = s.name.split(CROSS_SPLIT).map((p) => p.trim()).filter(Boolean);
        if (parts.length < 2) continue; // not a cross-shaped name
        for (const part of parts) {
          const parentId = resolveComponent(part);
          if (parentId && parentId !== s.id) nameEdges.push({ parent: parentId, child: s.id });
        }
      }

      // 6. Combine + structurally clean. `crosses`-column edges (remapped onto
      // canonical nodes) go first, then name-mined ones. Drop dangling (endpoint
      // not a surviving canonical node), self-loops, duplicates, patch-dropped.
      const remappedCross = crossEdges.map((e) => ({ parent: canon(e.parent), child: canon(e.child) }));
      const dropKeys = new Set((patch.dropEdges ?? []).map((e) => `${e.parent}->${e.child}`));
      const seenEdge = new Set<string>();
      const candidates: Lineage[] = [];
      for (const e of [...remappedCross, ...nameEdges, ...(patch.addEdges ?? [])]) {
        const key = `${e.parent}->${e.child}`;
        if (dropKeys.has(key)) continue;
        if (!canonStrains.has(e.parent) || !canonStrains.has(e.child)) continue;
        if (e.parent === e.child) continue;
        if (seenEdge.has(key)) continue;
        seenEdge.add(key);
        candidates.push(e);
      }

      // 7. Insert edges through a reachability guard so the result is a DAG by
      // construction. Crowd + name-mined lineage can imply cycles (A names B as a
      // parent while B names A); compile() hard-fails on any cycle, so we skip the
      // edge that would close a loop rather than let it break the build.
      const adj = new Map<string, Set<string>>();
      const reaches = (from: string, to: string): boolean => {
        const stack = [from];
        const seen = new Set<string>();
        while (stack.length) {
          const n = stack.pop()!;
          if (n === to) return true;
          if (seen.has(n)) continue;
          seen.add(n);
          for (const nxt of adj.get(n) ?? []) stack.push(nxt);
        }
        return false;
      };
      const lineage: Lineage[] = [];
      let cyclic = 0;
      for (const e of candidates) {
        if (reaches(e.child, e.parent)) {
          cyclic++; // adding parent->child would close a cycle
          continue;
        }
        (adj.get(e.parent) ?? adj.set(e.parent, new Set()).get(e.parent)!).add(e.child);
        lineage.push(e);
      }

      // 8. Trim: a crowd dump is ~94% isolated rows. Keep only strains that
      // participate in the lineage; the disconnected cloud adds weight, not signal.
      const connected = new Set<string>();
      for (const e of lineage) {
        connected.add(e.parent);
        connected.add(e.child);
      }
      const strains = [...canonStrains.values()].filter((s) => connected.has(s.id));

      console.log(
        `  ↳ kushy massage: ${strainById.size} raw → ${canonStrains.size} canonical ` +
          `(${strainById.size - canonStrains.size} dup/alias merged); ` +
          `${remappedCross.length} crosses-col + ${nameEdges.length} name-mined → ${candidates.length} unique, ` +
          `${cyclic} cyclic skipped → ${lineage.length} edges over ${strains.length} connected ` +
          `(trimmed ${canonStrains.size - strains.length} isolated).`,
      );

      return { strains, lineage };
    },
  };
}
