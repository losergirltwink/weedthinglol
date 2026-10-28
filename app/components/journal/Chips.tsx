/** A row of small tag chips; `tone="warn"` for side-effects. */
export function Chips({ items, tone = "plain" }: { items: string[]; tone?: "plain" | "warn" }) {
  if (!items.length) return null;
  const cls =
    tone === "warn"
      ? "border border-amber-900/60 text-amber-500/90"
      : "bg-zinc-800 text-zinc-300";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`rounded-full px-2 py-0.5 text-xs capitalize ${cls}`}>
          {t}
        </span>
      ))}
    </div>
  );
}
