// Public site identity. Pseudonymous by design: nothing here (or anywhere public)
// derives from the owner's GitHub profile — see docs/phase-5-plan.md 5E.
export const SITE_NAME = "Strain Genealogy";
export const SITE_DESCRIPTION =
  "An explorable family tree of cannabis strains, plus one person's tasting journal and taste profile.";

/**
 * Canonical public origin for metadata, sitemap and OG URLs. Deliberately
 * lenient (no validation, no throw) so a misconfigured env can never take down
 * public pages via metadata — auth paths validate strictly through env().
 */
export function siteUrl(): URL {
  const raw =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000";
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}
