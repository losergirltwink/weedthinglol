import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lineage, Strain } from "@/app/lib/strains";
import type { SourceDef } from "@/data/sources";
import { buildCatalog, classifyNameKind, compile, mergeSources, serializeCatalog, type Provenance } from "./compile";

const curatedProv = (): Provenance => ({ source: "curated", confidence: "curated" });
const s = (id: string, name: string, extra: Partial<Strain> = {}): Strain => ({
  id,
  name,
  type: "hybrid",
  ...extra,
});
const e = (parent: string, child: string): Lineage => ({ parent, child });

// The compiler narrates its work; keep test output readable.
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("compile validation", () => {
  it("accepts a clean DAG", () => {
    const { errors } = compile([s("a", "A"), s("b", "B")], [e("a", "b")], curatedProv);
    expect(errors).toEqual([]);
  });

  it.each([
    ["duplicate id", [s("a", "A"), s("a", "A2")], [], /Duplicate strain id/],
    ["duplicate strainKey", [s("a", "Blue Dream"), s("b", "Blue-Dream")], [], /Duplicate strainKey "blue-dream"/],
    ["empty strainKey", [s("a", "?!")], [], /empty strainKey/],
    ["unknown parent", [s("a", "A")], [e("ghost", "a")], /unknown parent/],
    ["unknown child", [s("a", "A")], [e("a", "ghost")], /unknown child/],
    ["self-loop", [s("a", "A")], [e("a", "a")], /Self-loop/],
    ["duplicate edge", [s("a", "A"), s("b", "B")], [e("a", "b"), e("a", "b")], /Duplicate lineage edge/],
    [
      "cycle",
      [s("a", "A"), s("b", "B"), s("c", "C")],
      [e("a", "b"), e("b", "c"), e("c", "a")],
      /Cycle detected/,
    ],
  ] as const)("rejects %s", (_name, strains, lineage, pattern) => {
    const { errors } = compile([...strains], [...lineage], curatedProv);
    expect(errors.join("\n")).toMatch(pattern);
  });

  it("rejects non-http(s) and unlabeled citations", () => {
    for (const citation of [
      { label: "x", url: "javascript:alert(1)" },
      { label: "x", url: "ftp://example.com" },
      { label: " ", url: "https://example.com" },
    ]) {
      const { errors } = compile([s("a", "A", { citations: [citation] })], [], curatedProv);
      expect(errors.join("\n")).toMatch(/invalid citation/);
    }
  });

  it("rejects an unknown lineageStatus", () => {
    const bad = s("a", "A", { lineageStatus: "vibes" as Strain["lineageStatus"] });
    expect(compile([bad], [], curatedProv).errors.join("\n")).toMatch(/unknown lineageStatus/);
  });

  it("warns (not errors) on uncited curated strains", () => {
    const { errors } = compile([s("a", "A")], [], curatedProv);
    expect(errors).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/1 curated strain\(s\) have no citation/));
  });
});

describe("compile derived + baked attributes", () => {
  // root -> mid -> leaf, plus root -> leaf (leaf's generation is the LONGEST path).
  const { graph } = compile(
    [
      s("root", "Root", { effects: ["happy", "Dry Mouth"] }),
      s("mid", "Mid", {
        citations: [{ label: "Breeder", url: "https://example.com" }],
        lineageStatus: "confirmed",
      }),
      s("leaf", "Leaf"),
    ],
    [e("root", "mid"), e("mid", "leaf"), e("root", "leaf")],
    curatedProv,
  );

  it("computes generation as the longest path from a root", () => {
    expect(graph.getNodeAttribute("root", "generation")).toBe(0);
    expect(graph.getNodeAttribute("mid", "generation")).toBe(1);
    expect(graph.getNodeAttribute("leaf", "generation")).toBe(2);
  });

  it("counts distinct descendants", () => {
    expect(graph.getNodeAttribute("root", "descendants")).toBe(2);
    expect(graph.getNodeAttribute("leaf", "descendants")).toBe(0);
  });

  it("partitions side-effects out of effects", () => {
    expect(graph.getNodeAttribute("root", "effects")).toEqual(["happy"]);
    expect(graph.getNodeAttribute("root", "negatives")).toEqual(["Dry Mouth"]);
  });

  it("bakes strainKey, provenance, citations and lineage status", () => {
    const mid = graph.getNodeAttributes("mid");
    expect(mid.strainKey).toBe("mid");
    expect(mid.source).toBe("curated");
    expect(mid.confidence).toBe("curated");
    expect(mid.lineageStatus).toBe("confirmed");
    expect(mid.citations).toHaveLength(1);
    expect(graph.getNodeAttributes("leaf")).not.toHaveProperty("citations");
  });

  it("lays out deterministically", () => {
    const again = compile(
      [s("root", "Root", { effects: ["happy", "Dry Mouth"] }), s("mid", "Mid"), s("leaf", "Leaf")],
      [e("root", "mid"), e("mid", "leaf"), e("root", "leaf")],
      curatedProv,
    ).graph;
    for (const n of ["root", "mid", "leaf"]) {
      expect(again.getNodeAttribute(n, "x")).toBe(graph.getNodeAttribute(n, "x"));
      expect(again.getNodeAttribute(n, "y")).toBe(graph.getNodeAttribute(n, "y"));
    }
  });
});

describe("classifyNameKind", () => {
  it("tags a cross-shaped name only when every component resolved to a parent", () => {
    expect(classifyNameKind("Blueberry x Haze", 2)).toEqual({ kind: "cross", shaped: true });
    expect(classifyNameKind("Blueberry x Haze", 1)).toEqual({ kind: "named", shaped: true });
  });

  it("recognizes ×, x and / delimiters but never splits inside a word", () => {
    expect(classifyNameKind("A × B", 2).kind).toBe("cross");
    expect(classifyNameKind("A / B / C", 3).kind).toBe("cross");
    expect(classifyNameKind("Maxx OG", 5)).toEqual({ kind: "named", shaped: false });
  });

  it("does not treat a breeder credit as a cross", () => {
    expect(classifyNameKind("Super Glue by NOTA", 2)).toEqual({ kind: "named", shaped: false });
  });
});

describe("mergeSources", () => {
  const curated: SourceDef = {
    id: "curated",
    label: "Curated",
    confidence: "curated",
    dir: "curated",
    attribution: "",
  };
  const crowd: SourceDef = { id: "crowd", label: "Crowd", confidence: "crowd", dir: "crowd", attribution: "" };

  it("keeps the higher-trust node verbatim and re-points crowd edges onto it", () => {
    const { strains, lineage, origin } = mergeSources([
      { src: curated, data: { strains: [s("sour-diesel", "Sour Diesel", { type: "sativa" })], lineage: [] } },
      {
        src: crowd,
        data: {
          strains: [s("k1", "Sour-Diesel", { type: "indica" }), s("k2", "Sour Kush")],
          lineage: [e("k1", "k2")],
        },
      },
    ]);
    expect(strains.map((x) => x.id).sort()).toEqual(["k2", "sour-diesel"]);
    expect(strains.find((x) => x.id === "sour-diesel")?.type).toBe("sativa"); // curated wins
    expect(lineage).toEqual([e("sour-diesel", "k2")]);
    expect(origin.get("sour-diesel")?.confidence).toBe("curated");
    expect(origin.get("k2")?.source).toBe("crowd");
  });

  it("skips an edge that would close a cycle across sources", () => {
    const { lineage } = mergeSources([
      { src: curated, data: { strains: [s("a", "A"), s("b", "B")], lineage: [e("a", "b")] } },
      { src: crowd, data: { strains: [s("ka", "A"), s("kb", "B")], lineage: [e("kb", "ka")] } },
    ]);
    expect(lineage).toEqual([e("a", "b")]);
  });

  it("drops edges that collapse to self-loops or duplicates after folding", () => {
    const { lineage } = mergeSources([
      { src: curated, data: { strains: [s("a", "A"), s("b", "B")], lineage: [e("a", "b")] } },
      {
        src: crowd,
        data: { strains: [s("ka", "A"), s("ka2", "a"), s("kb", "B")], lineage: [e("ka", "ka2"), e("ka", "kb")] },
      },
    ]);
    expect(lineage).toEqual([e("a", "b")]);
  });
});

describe("buildCatalog", () => {
  const { graph } = compile(
    [s("p", "Skunk #1"), s("c", "Super Skunk", { lineageStatus: "reported" })],
    [e("p", "c")],
    curatedProv,
  );
  const catalog = buildCatalog(graph);

  it("keys entries by strainKey and expresses lineage in strainKeys", () => {
    expect(Object.keys(catalog)).toEqual(["skunk-no1", "super-skunk"]);
    expect(catalog["super-skunk"]).toMatchObject({
      name: "Super Skunk",
      parents: ["skunk-no1"],
      children: [],
      lineageStatus: "reported",
      confidence: "curated",
    });
    expect(catalog["skunk-no1"].children).toEqual(["super-skunk"]);
  });

  it("strips layout attributes", () => {
    expect(catalog["skunk-no1"]).not.toHaveProperty("x");
    expect(catalog["skunk-no1"]).not.toHaveProperty("color");
  });

  it("serializes to parseable one-entry-per-line JSON", () => {
    const text = serializeCatalog(catalog);
    expect(JSON.parse(text)).toEqual(catalog);
    expect(text.trim().split("\n")).toHaveLength(2 + Object.keys(catalog).length);
  });
});
