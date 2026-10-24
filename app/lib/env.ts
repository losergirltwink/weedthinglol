// Server environment, validated with zod. Validation is LAZY (first call to
// `env()`), not at import: `next build` imports route modules to collect page
// data, and CI builds without secrets. A request that needs config fails loudly
// with every problem listed; the build never does.

import "server-only";

import { z } from "zod";

import { LOCAL_DATABASE_URL } from "@/db/client";

const fields = z.object({
  // postgres://… (Neon in production) or pglite://<dir> for local dev.
  DATABASE_URL: z
    .string()
    .regex(/^(postgres(ql)?|pglite):\/\//, "must be a postgres:// or pglite:// URL")
    .default(LOCAL_DATABASE_URL),
  // Signs session cookies. Generate with `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  // Canonical public origin, e.g. https://example.com. Also the passkey RP origin.
  // Unset on Vercel previews → falls back to that deployment's VERCEL_URL.
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  // The ONE GitHub account allowed to sign in: its numeric user id (stable
  // across username changes). `gh api user --jq .id` prints yours.
  OWNER_GITHUB_ID: z.string().regex(/^\d+$/, "must be a numeric GitHub user id").optional(),
});

export type Env = z.infer<typeof fields>;

/** Validate a raw env record. Exported for tests; app code calls `env()`. */
export function parseEnv(
  source: Record<string, string | undefined>,
  isProd: boolean,
): { success: true; data: Env } | { success: false; error: string } {
  const schema = fields.superRefine((e, ctx) => {
    const need = (key: keyof Env, why: string) => {
      if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `required ${why}` });
    };
    if (isProd) {
      need("BETTER_AUTH_SECRET", "in production");
      need("OWNER_GITHUB_ID", "in production");
      need("GITHUB_CLIENT_ID", "in production");
      need("GITHUB_CLIENT_SECRET", "in production");
      if (e.DATABASE_URL.startsWith("pglite:")) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "PGlite is local-only; production needs a postgres:// URL",
        });
      }
    }
    if (!!e.GITHUB_CLIENT_ID !== !!e.GITHUB_CLIENT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["GITHUB_CLIENT_SECRET"],
        message: "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together",
      });
    }
  });
  // Treat empty strings (common in .env files) as unset.
  const raw: Record<string, string | undefined> = Object.fromEntries(
    Object.keys(fields.shape).map((k) => [k, source[k] || undefined]),
  );
  if (!raw.BETTER_AUTH_URL && source.VERCEL_URL) raw.BETTER_AUTH_URL = `https://${source.VERCEL_URL}`;
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, error: z.prettifyError(parsed.error) };
}

let cached: Env | undefined;

/** Validated server env. Throws listing every issue until the env is fixed. */
export function env(): Env {
  if (cached) return cached;
  const parsed = parseEnv(process.env, process.env.NODE_ENV === "production");
  if (!parsed.success) throw new Error(`Invalid environment:\n${parsed.error}`);
  cached = parsed.data;
  return cached;
}
