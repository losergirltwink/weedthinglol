import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { appendRows, inline } from "./curated-format";

const read = (f: string) => readFileSync(resolve(process.cwd(), "data/curated", f), "utf8");

describe("appendRows", () => {
  it.each(["strains.json", "lineage.json"])("leaves existing bytes of %s untouched", (file) => {
    const text = read(file);
    const rec = { id: "new-strain", name: "New Strain" };
    const out = appendRows(text, [rec]);
    const prefix = text.slice(0, text.lastIndexOf("}") + 1);
    expect(out.startsWith(prefix)).toBe(true);
    expect(JSON.parse(out)).toEqual([...JSON.parse(text), rec]);
    expect(out.endsWith(`\n\n  ${inline(rec)}\n]\n`)).toBe(true);
  });

  it("appends to an empty array", () => {
    expect(appendRows("[\n]\n", [{ a: 1 }, { a: 2 }])).toBe('[\n  { "a": 1 },\n  { "a": 2 }\n]\n');
  });

  it("is a no-op with nothing to add", () => {
    expect(appendRows("[\n]\n", [])).toBe("[\n]\n");
  });
});

describe("inline", () => {
  it("matches the file style, including nested citations", () => {
    expect(inline({ id: "x", effects: ["a", "b"], citations: [{ label: "L", url: "https://e.x" }], skip: undefined })).toBe(
      '{ "id": "x", "effects": ["a", "b"], "citations": [{ "label": "L", "url": "https://e.x" }] }',
    );
  });

  it("reproduces every existing curated line exactly", () => {
    for (const file of ["strains.json", "lineage.json"]) {
      const lines = read(file).split("\n").filter((l) => l.startsWith("  {"));
      for (const line of lines) {
        const json = line.trim().replace(/,$/, "");
        expect(`  ${inline(JSON.parse(json))}`).toBe(line.replace(/,$/, ""));
      }
    }
  });
});
