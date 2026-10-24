import Link from "next/link";

import { SITE_NAME } from "@/app/lib/site";

/** Plain dark page frame for the non-graph pages (journal, account, sign-in). */
export function PageShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <nav className="flex items-center justify-between gap-4 text-sm">
          <Link href="/" className="text-zinc-400 hover:text-zinc-100">
            🌿 {SITE_NAME}
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/journal" className="text-zinc-400 hover:text-zinc-100">
              Journal
            </Link>
            {actions}
          </div>
        </nav>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
