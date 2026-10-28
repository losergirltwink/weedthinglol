// Editing the hand-authored curated files (data/curated/*.json). They use a
// one-record-per-line style (`  { "id": "x", "effects": ["a", "b"] },`) with
// blank lines separating thematic groups. Tooling (pnpm promote) must not
// reformat them: `appendRows` adds records as a new group just before the
// closing `]` and leaves every existing byte untouched.

/** Inline JSON with `, ` / `: ` separators and `{ … }` padding (the file style). */
export function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
  if (value && typeof value === "object") {
    const parts = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`);
    return `{ ${parts.join(", ")} }`;
  }
  return JSON.stringify(value);
}

/** Append `items` to a curated JSON-array file's text as a new group. */
export function appendRows(fileText: string, items: unknown[]): string {
  if (!items.length) return fileText;
  const close = fileText.lastIndexOf("]");
  if (close < 0) throw new Error("Not a JSON array file");
  const body = fileText.slice(0, close).trimEnd();
  const isEmpty = body.endsWith("[");
  const rows = items.map((i) => `  ${inline(i)}`).join(",\n");
  return `${body}${isEmpty ? "\n" : ",\n\n"}${rows}\n]\n`;
}
