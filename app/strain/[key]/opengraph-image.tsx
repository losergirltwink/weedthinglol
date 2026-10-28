import { OG_SIZE, ogCard } from "@/app/lib/og";
import { resolveStrain } from "@/app/lib/strain-resolver";
import { CONFIDENCE_META, TYPE_COLORS } from "@/app/lib/strains";
import { getDb } from "@/db";

export const alt = "Strain lineage card";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const strain = await resolveStrain(await getDb(), (await params).key);
  if (!strain) return ogCard({ title: "Unknown strain", subtitle: "Not in the family tree" });
  const lineage = strain.parents.length ? `${strain.parents.length} parent${strain.parents.length === 1 ? "" : "s"}` : "root";
  const tier = strain.confidence === "curated" ? "" : ` · ${CONFIDENCE_META[strain.confidence].label}`;
  return ogCard({
    title: strain.name,
    subtitle: `${strain.strainType} · ${lineage} · ${strain.descendants} descendants${tier}`,
    accent: TYPE_COLORS[strain.strainType],
  });
}
