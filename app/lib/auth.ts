// Server-side Better Auth instance — passkeys + GitHub, single owner
// (owner-gate.ts; construction in auth-config.ts). Created lazily on first
// request: the build imports route modules without a configured environment,
// and the DB driver connects asynchronously.

import "server-only";

import { getDb } from "@/db";
import { makeAuth, type Auth } from "./auth-config";
import { env } from "./env";

async function createAuth(): Promise<Auth> {
  const e = env();
  return makeAuth(await getDb(), {
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    github:
      e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET
        ? { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET }
        : undefined,
    ownerGithubId: e.OWNER_GITHUB_ID,
  });
}

const g = globalThis as unknown as { __auth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  g.__auth ??= createAuth();
  return g.__auth;
}
