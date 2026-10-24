import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell } from "@/app/components/PageShell";
import { PersonalStrainForm } from "@/app/components/personal/PersonalStrainForm";
import { requireOwnerPage } from "@/app/lib/owner";
import { getPersonalStrain } from "@/app/lib/personal/queries";
import { strainOptions } from "@/app/lib/strain-resolver";
import { getDb } from "@/db";

export const metadata: Metadata = { title: "Edit strain", robots: { index: false } };

export default async function EditPersonalStrainPage({ params }: { params: Promise<{ key: string }> }) {
  await requireOwnerPage();
  const db = await getDb();
  const strain = await getPersonalStrain(db, (await params).key);
  if (!strain) notFound();
  return (
    <PageShell title={`Edit · ${strain.name}`}>
      <PersonalStrainForm
        options={await strainOptions(db)}
        existing={{
          key: strain.strainKey,
          name: strain.name,
          strainType: strain.strainType,
          parentKeys: strain.parentKeys,
          notes: strain.notes,
        }}
      />
    </PageShell>
  );
}
