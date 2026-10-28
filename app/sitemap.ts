import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getDb } from "@/db";
import { catalogEntries, hasStrain } from "./lib/catalog";
import { listPersonalStrains } from "./lib/personal/queries";
import { siteUrl } from "./lib/site";

// Curated + personal strain pages only: crowd (unverified) pages are noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Per request: it reads personal strains from the DB, and builds never have
  // DB access/secrets.
  await connection();
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const personal = (await listPersonalStrains(await getDb())).filter((p) => !hasStrain(p.strainKey));
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/journal"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/profile"), changeFrequency: "weekly", priority: 0.6 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.4 },
    ...catalogEntries()
      .filter((e) => e.confidence === "curated")
      .map((e) => ({ url: url(`/strain/${e.key}`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...personal.map((p) => ({ url: url(`/strain/${p.strainKey}`), lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
