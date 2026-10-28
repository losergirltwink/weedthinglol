import { describe, expect, it } from "vitest";

import { formatDay, ratingValue, stars } from "./format";

describe("stars", () => {
  it.each([
    [1, "½☆☆☆☆"],
    [2, "★☆☆☆☆"],
    [7, "★★★½☆"],
    [10, "★★★★★"],
  ])("%i halves → %s", (halves, glyphs) => {
    expect(stars(halves)).toBe(glyphs);
  });
});

it("ratingValue converts half-star units", () => {
  expect(ratingValue(7)).toBe(3.5);
});

it("formatDay never shifts the calendar date", () => {
  expect(formatDay("2026-01-01")).toBe("Jan 1, 2026");
});
