# Deploying (Vercel + Neon + GitHub OAuth)

One-time setup for the production site. Everything here is done in web
dashboards by the owner. The repo already contains the code side.

## 1. Neon database (via Vercel)

1. Vercel dashboard → **Storage → Create → Neon** (Marketplace integration), and
   connect it to this project for **Production and Preview**.
2. In the integration settings, enable **a database branch per preview
   deployment**. Each PR preview gets its own copy-on-write branch, so preview
   migrations never touch production data.
3. The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
   (direct). The app uses the pooled one at runtime, and migrations use the
   direct one (`db/migrate.ts`).

## 2. Vercel project

1. Import the GitHub repo. Framework preset: Next.js. Install command: default
   (pnpm is detected from `packageManager`).
2. **Build command:** `pnpm db:migrate && pnpm build`, so migrations apply
   before each deploy, against that deployment's own database branch.
3. **Production branch:** `main`. Every PR gets a preview deploy.

## 3. GitHub OAuth app (sign-in)

GitHub → Settings → Developer settings → **OAuth Apps → New**:

- Homepage URL: `https://<your-domain>`
- Authorization callback URL: `https://<your-domain>/api/auth/callback/github`

Create a **second, dev-only** OAuth app with callback
`http://localhost:3000/api/auth/callback/github` for local sign-in. GitHub
OAuth apps allow one callback host each.

## 4. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | auto | auto (per-branch) | set by the Neon integration |
| `BETTER_AUTH_SECRET` | ✔ | ✔ (a different value) | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<your-domain>` | leave unset | previews fall back to `VERCEL_URL` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✔ | ✔ (same app) | |
| `OWNER_GITHUB_ID` | ✔ | ✔ | your numeric id: `gh api user --jq .id` |

The app validates these lazily (`app/lib/env.ts`): a misconfigured deployment
fails on the first request that needs them, listing every problem. The build
does not depend on them.

## 5. First sign-in

1. Visit `/sign-in` on the production domain → **Sign in with GitHub**.
2. Go to `/account` → **Add passkey** on each device you use. From then on
   passkeys are the primary sign-in, and GitHub is the recovery path.

### Known limits (by design)

- **Sign-in only works on the canonical domain** (and localhost in dev).
  Passkeys are bound to the domain, and the GitHub OAuth app has a single
  callback host. Previews are for checking the read-only site.
- Only the GitHub account matching `OWNER_GITHUB_ID` can ever sign up or get a
  session (`app/lib/owner-gate.ts`, covered by `owner-gate.test.ts`). Every
  write re-checks ownership server-side (`requireOwner()` in
  `app/lib/owner.ts`).

## Local development

Nothing is required: `pnpm dev` uses an on-disk PGlite database in `.data/`
that migrates itself. To sign in locally, copy `.env.example` to `.env.local`
and fill in the dev OAuth app + `OWNER_GITHUB_ID`. Delete `.data/` to reset
the local database.

## Backups & restore

Two independent layers:

1. **Neon point-in-time restore** (provider-side). Neon keeps a history window
   (its length depends on your plan). To recover: Neon console → **Branches →
   Restore** to a timestamp (or create a branch from that point and repoint
   `DATABASE_URL` at it).
2. **Portable JSON export** (provider-independent; your data, your file):

   ```sh
   DATABASE_URL_UNPOOLED=<neon direct url> pnpm journal:export backup.json
   DATABASE_URL_UNPOOLED=<target url>      pnpm journal:import backup.json [--replace]
   ```

   It covers journal sessions, the want-to-try list and personal strains. Auth
   tables are excluded on purpose (sign in again to recreate them). Import is
   validated and atomic, and refuses to merge into existing data without
   `--replace`. `journal-backup-*.json` is gitignored. **Never commit a
   backup**: it contains private sessions.

**Restore drill:** `db/backup.test.ts` exports from one database, imports into
a fresh one, and requires identical data. It runs in CI. Before relying on it
in production, also do one manual run against a Neon branch: export prod,
import into a fresh branch, and spot-check `/journal` on a preview pointed at
it.

## Release checklist (develop → main)

1. CI green on `develop` (typecheck, lint, tests, graph + migration drift,
   build).
2. Preview deploy of `develop` checked: explorer loads, `/journal`, `/profile`,
   a strain page, sign-in on the production domain only.
3. `pnpm journal:export` a fresh backup of production.
4. Open the release PR `develop` → `main` and merge. Vercel runs
   `pnpm db:migrate && pnpm build` against production.
5. Smoke test production: response headers include the nonce CSP, `/robots.txt`
   and `/sitemap.xml` resolve, an OG image renders, and nothing on a public
   page shows your GitHub name, email or avatar.
