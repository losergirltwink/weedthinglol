// Display helpers for journal data (pure; safe on server and client).

/** Half-star units (1–10) → star glyphs, e.g. 7 → "★★★½☆". */
export function stars(halves: number): string {
  const full = Math.floor(halves / 2);
  const half = halves % 2;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - half);
}

/** Half-star units → a number of stars, e.g. 7 → 3.5. */
export const ratingValue = (halves: number) => halves / 2;

/** "2026-10-23" → "Oct 23, 2026", rendered in UTC so the date never shifts. */
export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date as YYYY-MM-DD in the viewer's local time (for form defaults). */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normalize a free-form tag: trim, lowercase, collapse inner whitespace. */
export const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
