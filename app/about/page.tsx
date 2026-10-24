import type { Metadata } from "next";
import Link from "next/link";

import { Disclaimer } from "@/app/components/Disclaimer";
import { PageShell } from "@/app/components/PageShell";
import { CONFIDENCE_META, type Confidence } from "@/app/lib/strains";
import { SOURCES } from "@/data/sources";

export const metadata: Metadata = {
  title: "About",
  description: "How the strain family tree, journal, and taste profile work, and where the data comes from.",
};

const TIERS: Confidence[] = ["curated", "crowd", "personal"];

export default function AboutPage() {
  return (
    <PageShell title="About">
      <div className="max-w-2xl space-y-8 text-sm leading-relaxed text-zinc-300">
        <section className="space-y-2">
          <p>
            A personal, for-fun project: an explorable family tree of cannabis strains (most strains are crosses of
            other strains, so their ancestry forms a deep graph), plus one person&apos;s tasting journal and the taste
            profile it adds up to.
          </p>
          <Disclaimer />
        </section>

        <Section title="Data & trust">
          <p>Every strain carries a provenance tier, shown as a badge and as brightness in the graph:</p>
          <ul className="mt-2 space-y-1.5">
            {TIERS.map((t) => (
              <li key={t} className="flex items-baseline gap-2">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CONFIDENCE_META[t].color }} />
                <span>
                  <strong className="font-medium text-zinc-100">{CONFIDENCE_META[t].label}</strong>:{" "}
                  {CONFIDENCE_META[t].blurb.toLowerCase()}.
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Curated records can cite sources and mark their parentage as confirmed, reported, or disputed. Unverified
            strains get promoted into the curated set over time, once checked.
          </p>
        </Section>

        <Section title="Sources & attribution">
          <ul className="space-y-2">
            {SOURCES.map((s) => (
              <li key={s.id}>
                <strong className="font-medium text-zinc-100">{s.label}.</strong> {s.attribution}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-zinc-500">
            Only factual fields are republished (names, types, lineage, effect tags), never third-party descriptions.
          </p>
        </Section>

        <Section title="How the taste profile works">
          <p>
            Each journal session is compared with the average rating, so the profile reflects what separates good
            sessions from bad ones rather than what gets logged most. Effects and flavors are scored that way; lineage
            affinity flows up to a strain&apos;s ancestors, halving each generation. &ldquo;For me&rdquo;
            recommendations rank untried strains against that profile and steer away from frequently reported side
            effects. The public profile only uses public sessions.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            No accounts for visitors and no tracking cookies; page analytics are cookieless and aggregate. Journal
            entries record the date, never the time.
          </p>
        </Section>

        <p>
          <Link href="/" className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-100">
            ← Back to the family tree
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}
