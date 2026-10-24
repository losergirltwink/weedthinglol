"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { normalizeName } from "@/app/lib/strain-key";

interface Option {
  key: string;
  name: string;
  confidence: string;
}

/** Search the catalog and pick a strain to log (links to ?strain=<key>). */
export function StrainPicker({ options }: { options: Option[] }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = normalizeName(q);
    if (!needle) return [];
    return options.filter((o) => normalizeName(o.name).includes(needle)).slice(0, 20);
  }, [q, options]);

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search strains…"
        aria-label="Search strains"
        className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {matches.length > 0 && (
        <ul className="divide-y divide-zinc-800 rounded-lg bg-zinc-900">
          {matches.map((o) => (
            <li key={o.key}>
              <Link
                href={`/journal/new?strain=${encodeURIComponent(o.key)}`}
                className="flex items-center justify-between px-4 py-2 text-sm hover:bg-zinc-800"
              >
                <span>{o.name}</span>
                {o.confidence !== "curated" && <span className="text-xs text-zinc-500">unverified</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q && matches.length === 0 && (
        <p className="text-sm text-zinc-500">
          No match. Strains not in the graph can be added later (personal strains are a planned
          feature).
        </p>
      )}
    </div>
  );
}
