// The single-owner gate, exercised through the REAL Better Auth instance
// (makeAuth) on a migrated in-memory Postgres — hooks, adapter transaction and
// all. These are the security properties the public site depends on.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbHandle } from "@/db/client";
import { account, session, user } from "@/db/schema";
import { freshDb } from "@/test/db";
import { makeAuth } from "./auth-config";
import { isOwnerUser } from "./owner-gate";

const OWNER = "1234567";
const STRANGER = "7654321";

let h: DbHandle;
beforeEach(async () => {
  h = await freshDb();
  vi.spyOn(console, "warn").mockImplementation(() => {}); // dev-secret warning
});
afterEach(async () => {
  await h.close();
  vi.restoreAllMocks();
});

// `null` = OWNER_GITHUB_ID unset (not `undefined`, which would hit the default).
async function adapter(ownerGithubId: string | null = OWNER) {
  const auth = makeAuth(h.db, {
    baseURL: "http://localhost:3000",
    ownerGithubId: ownerGithubId ?? undefined,
  });
  return (await auth.$context).internalAdapter;
}

const profile = (email: string) => ({ name: "Someone", email, emailVerified: true });
const github = (accountId: string) => ({ providerId: "github", accountId });

describe("sign-up (account creation)", () => {
  it("lets the owner's GitHub identity sign up and get a session", async () => {
    const ia = await adapter();
    const { user: u } = await ia.createOAuthUser(profile("owner@example.com"), github(OWNER));
    expect(await isOwnerUser(h.db, u.id, OWNER)).toBe(true);
    await expect(ia.createSession(u.id)).resolves.toMatchObject({ userId: u.id });
  });

  it("rejects any other GitHub account and rolls back the user row", async () => {
    const ia = await adapter();
    await expect(ia.createOAuthUser(profile("x@example.com"), github(STRANGER))).rejects.toThrow(
      /single owner/,
    );
    expect(await h.db.select().from(user)).toHaveLength(0);
    expect(await h.db.select().from(account)).toHaveLength(0);
  });

  it("rejects non-GitHub providers even with the owner's id", async () => {
    const ia = await adapter();
    await expect(
      ia.createOAuthUser(profile("x@example.com"), { providerId: "google", accountId: OWNER }),
    ).rejects.toThrow(/single owner/);
    expect(await h.db.select().from(user)).toHaveLength(0);
  });

  it("fails closed when OWNER_GITHUB_ID is unset", async () => {
    const ia = await adapter(null);
    await expect(ia.createOAuthUser(profile("o@example.com"), github(OWNER))).rejects.toThrow();
    expect(await h.db.select().from(user)).toHaveLength(0);
  });
});

describe("sign-in (session creation)", () => {
  it("refuses a session to a user without the owner's GitHub identity", async () => {
    // A user row that got in by some other path must still never get a session.
    await h.db.insert(user).values({ id: "u-x", name: "X", email: "x@example.com" });
    const ia = await adapter();
    await expect(ia.createSession("u-x")).rejects.toThrow(/single owner/);
    expect(await h.db.select().from(session)).toHaveLength(0);
  });

  it("stops honoring the owner if OWNER_GITHUB_ID changes", async () => {
    const { user: u } = await (await adapter()).createOAuthUser(profile("o@example.com"), github(OWNER));
    const rotated = await adapter("999");
    await expect(rotated.createSession(u.id)).rejects.toThrow(/single owner/);
  });
});

describe("isOwnerUser", () => {
  it("is false for unknown users and when unconfigured", async () => {
    expect(await isOwnerUser(h.db, "nobody", OWNER)).toBe(false);
    await h.db.insert(user).values({ id: "u1", name: "O", email: "o@example.com" });
    await h.db.insert(account).values({ id: "a1", userId: "u1", providerId: "github", accountId: OWNER });
    expect(await isOwnerUser(h.db, "u1", OWNER)).toBe(true);
    expect(await isOwnerUser(h.db, "u1", undefined)).toBe(false);
    expect(await isOwnerUser(h.db, "u1", STRANGER)).toBe(false);
  });
});
