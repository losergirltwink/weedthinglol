import { describe, expect, it } from "vitest";

import { strainKey } from "./strain-key";

describe("strainKey", () => {
  it("folds numbering variants onto one key", () => {
    expect(strainKey("Skunk #1")).toBe("skunk-no1");
    expect(strainKey("Skunk No. 1")).toBe("skunk-no1");
    expect(strainKey("Skunk No.1")).toBe("skunk-no1");
  });

  it("treats hyphens, spaces, and punctuation as the same separator", () => {
    expect(strainKey("Blue-Dream")).toBe("blue-dream");
    expect(strainKey("  Blue   Dream ")).toBe("blue-dream");
    expect(strainKey("$100 OG")).toBe(strainKey("100 OG"));
    expect(strainKey("Tranquil Elephantizer: Remix")).toBe(strainKey("Tranquil Elephantizer Remix"));
  });

  it("folds straight and curly apostrophes alike", () => {
    expect(strainKey("God's Treat")).toBe("gods-treat");
    expect(strainKey("God’s Treat")).toBe("gods-treat");
  });

  it("keeps + significant so distinct strains never merge", () => {
    expect(strainKey("Critical+")).toBe("critical-plus");
    expect(strainKey("Critical+")).not.toBe(strainKey("Critical"));
  });

  it("spells out ampersands (raw and HTML-escaped)", () => {
    expect(strainKey("Cookies & Cream")).toBe("cookies-and-cream");
    expect(strainKey("Cookies &amp; Cream")).toBe("cookies-and-cream");
  });

  it("is URL-safe", () => {
    expect(strainKey("Pre-98 Bubba Kush / ? (clone)")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
