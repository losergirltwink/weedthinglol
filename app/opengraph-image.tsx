import { OG_SIZE, ogCard } from "./lib/og";
import { SITE_NAME } from "./lib/site";

export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ title: "Strain family tree", subtitle: "Lineage explorer, tasting journal, and taste profile" });
}
