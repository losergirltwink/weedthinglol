// Strain identity (Phase 5). A node id is source-namespaced (`sour-diesel`,
// `kushy-123`) and changes when a strain is promoted between sources, so anything
// that must outlive a rebuild — reviews, wishlist entries, `/strain/[key]` URLs —
// references the `strainKey` instead. It's derived purely from the NAME, which is
// the same thing the kushy de-dup and the union merge already treat as identity:
// one key ⇔ one strain, in every graph.

// Fold the common naming inconsistencies so "Skunk No.1", "Skunk #1" and
// "Skunk No. 1" all key to one canonical form.
export const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/#\s*/g, "no") // "#1" / "# 1" -> "no1"
    .replace(/\bno\.?\s*/g, "no") // "no. 1" / "no 1" -> "no1"
    .replace(/['‘’"“”.,()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * URL-safe stable identity: the normalized name, slugified ("Skunk #1" ->
 * "skunk-no1", "Blue-Dream" and "Blue Dream" -> "blue-dream"). Use this — never
 * `normalizeName` directly — wherever two names are compared for identity, so
 * de-dup, the union, and persisted references can never disagree.
 */
export const strainKey = (name: string): string =>
  normalizeName(name)
    .replace(/&/g, " and ")
    // "Critical+" is a different strain from "Critical" — keep "+" significant.
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
