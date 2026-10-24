import { ratingValue, stars } from "@/app/lib/journal/format";

/** Read-only star rating from half-star units. */
export function Stars({ halves, className = "" }: { halves: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${ratingValue(halves)} out of 5 stars`}
      className={`tracking-wider text-amber-400 ${className}`}
    >
      {stars(halves)}
    </span>
  );
}
