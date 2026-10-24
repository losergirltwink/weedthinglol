import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageShell } from "@/app/components/PageShell";
import { EntryForm, type EntryFormValues } from "@/app/components/journal/EntryForm";
import { catalogVocabulary, strainName } from "@/app/lib/catalog";
import { getEntry } from "@/app/lib/journal/queries";
import { requireOwnerPage } from "@/app/lib/owner";
import { getDb } from "@/db";

export const metadata: Metadata = { title: "Edit session", robots: { index: false } };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const entry = await getEntry(await getDb(), id.data, { includePrivate: true });
  if (!entry) notFound();

  const initial: EntryFormValues = {
    ratingHalves: entry.ratingHalves,
    consumedOn: entry.consumedOn,
    notes: entry.notes ?? "",
    effectsFelt: entry.effectsFelt,
    negativesFelt: entry.negativesFelt,
    flavors: entry.flavors,
    terpenes: entry.terpenes,
    method: entry.method ?? "",
    timeOfDay: entry.timeOfDay ?? "",
    dose: entry.dose ?? "",
    brand: entry.brand ?? "",
    batch: entry.batch ?? "",
    wouldBuyAgain: entry.wouldBuyAgain == null ? "" : entry.wouldBuyAgain ? "yes" : "no",
    isPublic: entry.isPublic,
  };
  const name = strainName(entry.strainKey);

  return (
    <PageShell title={`Edit session · ${name}`}>
      <EntryForm
        strain={{ key: entry.strainKey, name }}
        vocabulary={catalogVocabulary()}
        entryId={entry.id}
        initial={initial}
      />
    </PageShell>
  );
}
