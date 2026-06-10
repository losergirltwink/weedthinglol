"use client";

import { STRAIN_TYPES, TYPE_COLORS, type StrainType } from "@/app/lib/strains";

interface Props {
  activeTypes: Set<StrainType>;
  onToggle: (type: StrainType) => void;
}

export function FilterLegend({ activeTypes, onToggle }: Props) {
  return (
    <div className="rounded-lg bg-zinc-900/85 p-3 text-sm shadow-lg backdrop-blur">
      <p className="mb-2 font-medium text-zinc-300">Type — click to filter</p>
      <ul className="space-y-1">
        {STRAIN_TYPES.map((type) => {
          const on = activeTypes.has(type);
          return (
            <li key={type}>
              <button
                onClick={() => onToggle(type)}
                className={`flex w-full items-center gap-2 rounded px-1 py-0.5 transition-opacity hover:bg-zinc-800 ${
                  on ? "opacity-100" : "opacity-35"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="capitalize text-zinc-300">{type}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
