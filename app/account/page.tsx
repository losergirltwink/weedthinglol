import type { Metadata } from "next";

import { PageShell } from "@/app/components/PageShell";
import { PasskeyManager } from "@/app/components/auth/PasskeyManager";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import { requireOwnerPage } from "@/app/lib/owner";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  await requireOwnerPage();
  return (
    <PageShell title="Account" actions={<SignOutButton />}>
      <PasskeyManager />
    </PageShell>
  );
}
