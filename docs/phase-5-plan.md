# Phase 5 — From toy explorer to a personal strain journal (public site)

Keep everything fun about the explorer (lineage graph, 2D/3D, recommender) and
add a **personal layer**: I log sessions, rate strains, build a taste profile,
and get recommendations aimed at *me*. The result ships as a public website.
Visitors can browse it read-only, and only I can write.

Goal: production-grade. CI, migrations, an auth boundary, backups, a security
baseline, and observability are part of the deliverable, not polish for later.

## Decisions (from planning Q&A, 2026-10-23)

| Axis | Decision |
| --- | --- |
| Crowd-data worry | **Accuracy/trust + staleness.** Plus licensing, which I added because the site will be public. |
| Kushy's fate | **Demote to an opt-in "unverified" layer + a promotion queue into curated.** |
| Audience | **Me, public read-only.** A single owner account. Visitors browse. |
| Stack | **Vercel + Neon Postgres**, Drizzle ORM, Auth.js |
| Auth | **Passkey (WebAuthn) + GitHub OAuth fallback**, owner allowlist |
| Review shape | Stars + notes, **effects felt**, **session context** (method/dose/time/brand/would-buy), **flavor/terpenes** |
| Personalization | Taste profile, profile-driven recs, ratings on the graph, want-to-try list |
| Off-graph strains | **Allowed**, as a new `personal` provenance tier |
| Review visibility | **Public by default**, with a per-review hide toggle |
| Compliance | Not-medical-advice disclaimer, cookieless analytics, **pseudonymous identity**. No age gate. |
| Order | **Data cleanup → prod foundation → reviews → personalization → launch** |

## Architecture: static graph, dynamic overlay

The core design choice is **keeping the graph static**. The baked
`public/graph.<source>.json` + offline ForceAtlas2 model stays as is: CDN-cached,
zero layout in the browser, still built by `pnpm build:graph`. Everything
personal lives in Postgres and arrives as an **overlay** that the client merges
in at view time. This is the existing principle (*separate at rest, unified at
view-time*) extended to one more axis.

```
build time                          runtime
data/<source>/ ──build:graph──▶ public/graph.*.json ─┐
                                                     ├─▶ useStrainExplorer ─▶ 2D / 3D
Neon: reviews, wishlist, ──/api/overlay──────────────┘     (+ personal state)
      personal_strains
```

### Stable strain identity (prerequisite)

Today node ids are source-namespaced (`kushy-123`, `sour-diesel`). Reviews need a
key that survives promotion from kushy into curated and the union merge. Use
**`strainKey = slug(normalizeName(name))`**, which is the identity the union
already matches on. `compile()` stamps `key` on every node. Reviews, wishlist
entries, and personal strains all reference `strainKey` and never a source id.
The DB doesn't foreign-key into the graph, because the graph isn't in the DB. A
CI check (5B) flags orphaned keys instead.

---

## 5A — Data foundation & trust

1. **Strip copied prose.** Kushy `description` → `note` is ~verbatim commercial
   copy and currently ships in `public/graph.kushy.json`. Drop `note` for crowd
   sources in the adapter. Keep the facts only: name, type, lineage, effect and
   flavor tags. Add an `attribution` field to `SourceDef`, rendered on an About
   page.
2. **Citations for curated.** Extend `Strain` with `citations?: {label, url}[]`
   and `lineageStatus: "confirmed" | "reported" | "disputed"`. In `compile()`,
   warn on curated records with no citation now, and make it an error once the
   backfill is done. Show both in `DetailPanel`.
3. **Relabel + demote kushy.** Rename it to "Unverified (2017 community)". It
   stays off by default and is opt-in through the dropdown. `all` stays
   available but isn't the landing view. Cross-expression and resting-dim
   behavior is unchanged.
4. **Promotion workflow** (the staleness fix: curated grows from real use):
   - `pnpm promote <strainKey>` scaffolds a curated record + edges from the
     kushy row, with `citations: []` / `lineageStatus: "reported"` TODOs, for
     me to verify and commit.
   - A **review-queue** view (owner-only) ranks kushy candidates by: in my
     wishlist/reviews > graph degree > number of curated neighbors.
   - The same path promotes `personal`-tier strains (5C) once their lineage is
     verified.
5. **Optional spike (timeboxed, ~1 day):** look for an openly licensed, more
   recent dataset (state lab-testing data, breeder catalogs with permissive
   terms). If one turns up, it goes through the existing `SourceAdapter` seam as
   a `documented` tier. Nothing below depends on it.
6. **Tests.** Add Vitest. Cover `compile()` validation (dups, cycles,
   dangling), `mergeSources()` precedence, `classifyNameKind`, and
   `recommend()`. This pure logic is about to get load-bearing.

## 5B — Production foundation

- **CI (GitHub Actions, on PRs to `develop` and `main`):** `tsc --noEmit`,
  eslint, vitest, `next build`, and a **graph drift check** (`pnpm build:graph
  && git diff --exit-code public/`), which enforces "never hand-edit graph
  JSON". Once this exists, turn on branch protection for `main`.
- **Vercel:** preview deploy per PR, prod deploys from `main`. **Neon
  branching** gives each preview its own DB branch.
- **DB:** Drizzle schema + SQL migrations committed under `db/`. A migration
  runs in CI against the preview branch before it touches prod.
- **Env:** validate env vars at boot with a typed schema (zod). Secrets live
  only in Vercel env. Ship a `.env.example`.
- **Auth (Auth.js v5):** passkey provider + GitHub. The **owner allowlist** is
  an env var (`OWNER_GITHUB_ID` / registered passkey). Every mutation is a
  server action or route handler that calls `requireOwner()` itself. Middleware
  is a UX redirect, **not** the security boundary.
- **Security baseline:** zod-validate every input. Render review notes as
  sanitized markdown with no raw HTML. Set a CSP (WebGL-compatible, no inline
  eval), HSTS, and `frame-ancestors 'none'`. Rate-limit the auth endpoints.
  Turn on Dependabot plus `pnpm audit` in CI. Run the `/security-review` pass
  before launch.
- **Observability:** Vercel logs + Sentry for client errors (the renderers are
  client-only, so this replaces "skim the dev log" in prod).
- **Backups & portability:** Neon point-in-time restore, plus a `pnpm
  export:journal` script that dumps all personal data to JSON (and optionally a
  scheduled export). The reviews are mine and shouldn't be locked in a vendor.

## 5C — Reviews & personal data

**Schema (Drizzle):**

- `sessions`: one row per consumption session, many per strain. Fields:
  `strain_key`, `rating` (0.5–5), `notes` (md), `effects_felt[]`,
  `negatives_felt[]`, `flavors[]`, `terpenes[]`, `method` (enum:
  flower/vape/concentrate/edible/tincture), `dose` (text), `time_of_day`,
  `brand`, `batch`, `would_buy_again`, `consumed_on` (**date only**, to keep
  timing patterns vague under pseudonymity), `is_public` (default `true`),
  timestamps.
- `wishlist`: `strain_key`, `source` (`rec` | `manual` | `graph`), `note`,
  `added_at`.
- `personal_strains`: `strain_key`, `name`, `strain_type`, `parent_keys[]`,
  `notes`. These are off-graph strains I've actually tried.

**Vocabulary:** effect and flavor pickers pull from the graph's existing tags
(`allEffects()`, `NEGATIVE_EFFECTS`), so felt-effects line up with strain data.
Free tags are allowed but normalized and lowercased. A new side effect gets
added to `NEGATIVE_EFFECTS` so the partition stays consistent.

**UI:**

- `DetailPanel` → "Log a session" (owner only) + aggregate (avg rating, times
  tried, most-felt effects).
- `/strain/[key]` is a server-rendered public page showing graph facts,
  lineage, citations, and public sessions. It's shareable and indexable, and
  doubles as the **accessible alternative** to the WebGL graph.
- `/journal` is a chronological session log (public view hides `is_public =
  false`).
- `/queue` is the owner-only promotion queue (5A.4).

## 5D — Personalization

All pure functions in `app/lib/`, unit-tested and renderer-agnostic, so 3D
gets them for free per the 3D policy.

- **Taste profile** (`app/lib/profile.ts`): center each rating on my mean
  (`w = rating − μ`) and accumulate:
  - effect vector: Σ w · felt effects (falls back to the strain's listed
    effects when none were tagged)
  - side-effect sensitivity: the negatives I report most
  - flavor/terpene vector
  - **lineage affinity**: propagate w to ancestors with decay `0.5^hops`,
    which surfaces "you love Haze descendants"
  - type and method affinity
  - Cold start: under ~5 sessions, show "keep logging" instead of noise.
- **`/profile` page:** top effects, lineage clusters I gravitate to, strains I
  rated highest/lowest, and side effects I'm sensitive to. Public, with the
  disclaimer.
- **Profile-driven recs:** add `recommendForProfile(graph, profile, opts)` next
  to `recommend()`. It seeds from the profile vector instead of a single strain,
  excludes strains already tried, and auto-avoids my top negatives.
  Explanations cite my own data ("grandchild of Jack Herer, which you rated
  5★"). `RecommendPanel` gains a "For me" mode, and any rec can be sent to the
  wishlist.
- **Graph overlay:** `useStrainExplorer` gains `personal` state (fetched from
  `/api/overlay`; visitors get the public subset). 2D reducers add a **rating
  ring** (diverging color), a **wishlist marker**, and a "favorite paths"
  highlight (union of shortest paths between my top-rated strains).
- **`personal` tier on the graph:** add `"personal"` to `Confidence` +
  `CONFIDENCE_META`. Personal strains are inserted client-side at runtime and
  **positioned at their parents' centroid + jitter**, so the browser still does
  no live layout. Unparented ones go in a fixed "unplaced" margin.
  `ProvenanceLegend` picks up the tier.

## 5E — Public launch

- **Site shell:** `/` explorer, `/strain/[key]`, `/journal`, `/profile`,
  `/about` (methodology, data sources + attribution, confidence tiers, "not
  medical advice"). Disclaimer in the footer and on the recs/profile pages.
- **Identity:** a pseudonymous display name/handle from config, never derived
  from GitHub. Audit that no GitHub username, email, or avatar reaches public
  HTML or OG images.
- **SEO/share:** per-page metadata, `next/og` images per strain, and a sitemap
  of **curated + personal** strains only (don't index unverified crowd pages).
- **Perf:** content-hashed, long-cached graph JSON. Kushy/all load lazily. Set
  a Lighthouse budget on the strain pages.
- **Analytics:** cookieless (Vercel Analytics or Plausible), so no cookie
  banner is needed.
- **Pre-launch checklist:** `/security-review`, a restore-from-backup drill,
  the identity-leak audit, and checking the host's acceptable-use terms for
  cannabis *information* content (likely fine, but verify). Then release
  `develop` → `main`.

## Milestones (each is a PR into `develop`)

1. ✅ 5A.1–3 data trust (strip prose, citations schema, relabel) + `strainKey`
   (citation *backfill* still open — 45 curated strains warn)
2. ✅ 5A.6 Vitest + 5B CI (incl. graph drift check) + Dependabot
   (branch protection on `main` still to switch on)
3. 5B Vercel/Neon/Drizzle/env + Auth.js owner gate, with an empty `/journal`
   deployed to preview
4. 5C sessions + wishlist + `/strain/[key]` + log-a-session UI
5. 5C personal strains + 5A.4 promote script/queue
6. 5D profile + `/profile`
7. 5D profile recs + graph overlay (2D. 3D sync only as a deliberate checkpoint)
8. 5E launch hardening → first `main` release

## Risks / open questions

- **Public-by-default + session context.** Brand, batch, dose, and day
  together say a lot about a real person. Mitigations: date-only timestamps, a
  pseudonymous handle, and an easy per-review hide. Revisit per-field
  visibility if it starts to feel too exposed.
- **Profile quality depends on volume.** It's meaningless until there are
  enough sessions. The cold-start messaging matters.
- **Curated is 53 strains.** Recs will lean on unverified neighbors until
  promotion catches up. The recommender should keep showing provenance in its
  explanations.
- **Strain-name ambiguity.** The same name can mean different genetics from
  different breeders. Out of scope for now. `strainKey` + an optional `breeder`
  field leave room for it later.
