import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/app/components/PageShell";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import { getViewer } from "@/app/lib/owner";

export const metadata: Metadata = {
  title: "Journal",
  description: "A personal log of strains tried, with ratings and notes.",
};

// Public, read-only for visitors; the owner additionally gets write controls.
// Session logging lands in milestone 4 (docs/phase-5-plan.md 5C).
export default async function JournalPage() {
  const { isOwner } = await getViewer();
  return (
    <PageShell
      title="Journal"
      actions={
        isOwner ? (
          <>
            <Link href="/account" className="text-zinc-400 hover:text-zinc-100">
              Account
            </Link>
            <SignOutButton />
          </>
        ) : null
      }
    >
      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
        No sessions logged yet.
        {isOwner && <p className="mt-2 text-zinc-600">Logging sessions is coming next.</p>}
      </div>
    </PageShell>
  );
}
