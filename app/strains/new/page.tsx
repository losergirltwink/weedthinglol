import type { Metadata } from "next";

import { PageShell } from "@/app/components/PageShell";
import { PersonalStrainForm } from "@/app/components/personal/PersonalStrainForm";
import { requireOwnerPage } from "@/app/lib/owner";
import { strainOptions } from "@/app/lib/strain-resolver";
import { getDb } from "@/db";

export const metadata: Metadata = { title: "Add a strain", robots: { index: false } };

export default async function NewPersonalStrainPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  await requireOwnerPage();
  const { name } = await searchParams;
  return (
    <PageShell title="Add a strain">
      <p className="mb-6 max-w-lg text-sm text-zinc-400">
        For strains the graph doesn&apos;t have. It&apos;s marked <em>personal</em> (unverified) and can later be
        promoted into the curated data.
      </p>
      <PersonalStrainForm options={await strainOptions(await getDb())} initialName={name?.slice(0, 80) ?? ""} />
    </PageShell>
  );
}
