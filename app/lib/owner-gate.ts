// The single-owner gate. This site has exactly one account that may sign in:
// the GitHub user whose numeric id is OWNER_GITHUB_ID. Enforced in layers —
//   1. account creation: only that GitHub identity can ever be linked, and a
//      rejected sign-up rolls back entirely (the adapter runs it in a transaction);
//   2. session creation: no session is minted for any other user, whatever the
//      sign-in method (GitHub or passkey);
//   3. every mutation re-checks `isOwnerUser` server-side (app/lib/owner.ts).
// Deliberately NOT `server-only` so it can be unit-tested against PGlite.

import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";

import type { Db } from "@/db/client";
import { account } from "@/db/schema";

const CLOSED = "This site has a single owner; sign-in is closed.";

/** True iff `userId` has the owner's GitHub identity linked. */
export async function isOwnerUser(
  db: Db,
  userId: string,
  ownerGithubId: string | undefined,
): Promise<boolean> {
  if (!ownerGithubId) return false; // fail closed when unconfigured
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "github"),
        eq(account.accountId, ownerGithubId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Better Auth `databaseHooks` implementing layers 1 and 2. */
export function ownerGateHooks(db: Db, ownerGithubId: string | undefined) {
  return {
    account: {
      create: {
        before: async (acct: { providerId: string; accountId: string }) => {
          // Throw (not `return false`): returning false skips only the account
          // insert, leaving an orphan user row; throwing aborts the transaction.
          if (!ownerGithubId || acct.providerId !== "github" || acct.accountId !== ownerGithubId) {
            throw new APIError("FORBIDDEN", { message: CLOSED });
          }
        },
      },
    },
    session: {
      create: {
        before: async (sess: { userId: string }) => {
          if (!(await isOwnerUser(db, sess.userId, ownerGithubId))) {
            throw new APIError("FORBIDDEN", { message: CLOSED });
          }
        },
      },
    },
  };
}
