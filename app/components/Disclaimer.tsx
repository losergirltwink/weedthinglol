/** Standing note for anything that reads like advice (profile, recommendations). */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-zinc-500 ${className}`}>
      Personal notes and pattern-matching from one person&apos;s experience, not medical advice. Effects vary
      with dose, method, setting, and individual chemistry.
    </p>
  );
}
