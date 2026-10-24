import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/app/components/PageShell";
import { SignInPanel } from "@/app/components/auth/SignInPanel";
import { env } from "@/app/lib/env";
import { getViewer } from "@/app/lib/owner";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if ((await getViewer()).isOwner) redirect("/journal");
  const { error } = await searchParams;
  return (
    <PageShell title="Sign in">
      <SignInPanel githubEnabled={!!env().GITHUB_CLIENT_ID} error={error} />
    </PageShell>
  );
}
