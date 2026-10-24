import { describe, expect, it } from "vitest";

import { normalizeTag } from "./format";
import { parseEntry } from "./input";

const base = { strainKey: "blue-dream", ratingHalves: 7, consumedOn: "2026-10-01" };

describe("parseEntry", () => {
  it("accepts a minimal entry and fills defaults", () => {
    const r = parseEntry(base);
    expect(r.ok && r.data).toMatchObject({
      ...base,
      notes: null,
      effectsFelt: [],
      method: null,
      wouldBuyAgain: null,
      isPublic: true,
    });
  });

  it("normalizes, de-dupes and drops empty tags", () => {
    const r = parseEntry({ ...base, flavors: ["  Citrus ", "citrus", "", "Sweet   Pine"] });
    expect(r.ok && r.data.flavors).toEqual(["citrus", "sweet pine"]);
  });

  it("moves side-effects tagged as effects into negatives", () => {
    const r = parseEntry({ ...base, effectsFelt: ["Happy", "Dry Mouth"], negativesFelt: ["paranoid"] });
    expect(r.ok && r.data.effectsFelt).toEqual(["happy"]);
    expect(r.ok && r.data.negativesFelt).toEqual(["paranoid", "dry mouth"]);
  });

  it("turns blank optional text into null and trims the rest", () => {
    const r = parseEntry({ ...base, notes: "   ", brand: "  Acme  " });
    expect(r.ok && r.data.notes).toBeNull();
    expect(r.ok && r.data.brand).toBe("Acme");
  });

  it.each([
    ["rating 0", { ratingHalves: 0 }, "ratingHalves"],
    ["rating 11", { ratingHalves: 11 }, "ratingHalves"],
    ["fractional rating", { ratingHalves: 7.5 }, "ratingHalves"],
    ["bad date", { consumedOn: "10/01/2026" }, "consumedOn"],
    ["future date", { consumedOn: "2999-01-01" }, "consumedOn"],
    ["unknown method", { method: "bong-of-doom" }, "method"],
    ["empty strain", { strainKey: " " }, "strainKey"],
    ["oversized tag", { flavors: ["x".repeat(41)] }, "flavors"],
    ["too many tags", { terpenes: Array.from({ length: 21 }, (_, i) => `t${i}`) }, "terpenes"],
    ["huge notes", { notes: "x".repeat(5001) }, "notes"],
  ])("rejects %s", (_name, override, field) => {
    const r = parseEntry({ ...base, ...override });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain(field);
  });

  it("rejects non-object junk", () => {
    expect(parseEntry("drop table").ok).toBe(false);
    expect(parseEntry(null).ok).toBe(false);
  });
});

describe("normalizeTag", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeTag("  Very   Relaxed ")).toBe("very relaxed");
  });
});
