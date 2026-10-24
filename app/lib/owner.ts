// Request-scoped owner checks for server components, route handlers and server
// actions. THIS is the security boundary for writes — never rely on proxy/
// middleware or on hiding UI. Every mutation starts with `await requireOwner()`.

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/db";
import { getAuth } from "./auth";
import { env } from "./env";
import { isOwnerUser } from "./owner-gate";

export interface Viewer {
  isOwner: boolean;
  userId: string | null;
}

/** Who is making this request. Memoized per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  // Read request headers FIRST: it marks the route dynamic before anything
  // touches env/DB, so pages using this are never prerendered at build time.
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { isOwner: false, userId: null };
  const isOwner = await isOwnerUser(await getDb(), session.user.id, env().OWNER_GITHUB_ID);
  return { isOwner, userId: session.user.id };
});

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/** Guard for server actions / route handlers: throws unless the owner. */
export async function requireOwner(): Promise<Viewer & { userId: string }> {
  const viewer = await getViewer();
  if (!viewer.isOwner || !viewer.userId) throw new ForbiddenError();
  return { ...viewer, userId: viewer.userId };
}

/** Guard for owner-only pages: redirects to sign-in unless the owner. */
export async function requireOwnerPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isOwner) redirect("/sign-in");
  return viewer;
}
