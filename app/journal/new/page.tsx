import type { Metadata } from "next";

import { PageShell } from "@/app/components/PageShell";
import { EntryForm } from "@/app/components/journal/EntryForm";
import { StrainPicker } from "@/app/components/journal/StrainPicker";
import { catalogIndex, catalogVocabulary, getCatalogEntry } from "@/app/lib/catalog";
import { requireOwnerPage } from "@/app/lib/owner";

export const metadata: Metadata = { title: "Log a session", robots: { index: false } };

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ strain?: string }> }) {
  await requireOwnerPage();
  const { strain: key } = await searchParams;
  const strain = key ? getCatalogEntry(key) : undefined;

  if (!strain) {
    return (
      <PageShell title="Log a session">
        <p className="mb-4 text-sm text-zinc-400">Which strain?</p>
        <StrainPicker options={catalogIndex()} />
      </PageShell>
    );
  }
  return (
    <PageShell title={`Log a session · ${strain.name}`}>
      <EntryForm strain={{ key: strain.key, name: strain.name }} vocabulary={catalogVocabulary()} />
    </PageShell>
  );
}
