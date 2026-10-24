// Better Auth construction, separated from env/DB lookup (auth.ts) so tests can
// build the REAL configured instance — hooks, adapter, plugins — against an
// in-memory database. Deliberately NOT `server-only`.

import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { ownerGateHooks } from "./owner-gate";
import { SITE_NAME } from "./site";

export interface AuthConfig {
  baseURL: string;
  secret?: string;
  github?: { clientId: string; clientSecret: string };
  ownerGithubId?: string;
}

export function makeAuth(db: Db, config: AuthConfig) {
  const origin = new URL(config.baseURL);
  return betterAuth({
    appName: SITE_NAME,
    baseURL: config.baseURL,
    // Required in production (env.ts); in dev Better Auth falls back to a
    // built-in development secret with a warning.
    secret: config.secret,
    // transaction: a rejected sign-up (owner gate) rolls back the user row too.
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: { enabled: false },
    socialProviders: config.github ? { github: config.github } : {},
    account: { accountLinking: { enabled: false } },
    rateLimit: { storage: "database" },
    databaseHooks: ownerGateHooks(db, config.ownerGithubId),
    plugins: [
      // Passkeys are bound to this origin's hostname — they only work on the
      // canonical domain (and localhost in dev), not on preview URLs.
      passkey({ rpID: origin.hostname, rpName: SITE_NAME, origin: origin.origin }),
      nextCookies(), // must stay last: lets server actions set auth cookies
    ],
  });
}

export type Auth = ReturnType<typeof makeAuth>;
