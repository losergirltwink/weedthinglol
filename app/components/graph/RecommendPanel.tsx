"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { TYPE_COLORS, type StrainType } from "@/app/lib/strains";
import type { StrainGraphType } from "@/app/lib/graph-utils";
import { setWishlistedAction } from "@/app/lib/journal/actions";
import type { Overlay } from "@/app/lib/overlay-types";
import { COLD_START_SESSIONS } from "@/app/lib/profile";
import {
  allEffects,
  negativeEffects,
  recommend,
  recommendForProfile,
  type ProfileRecommendation,
  type Recommendation,
} from "@/app/lib/recommend";
import type { GraphOverlay } from "@/app/lib/useStrainExplorer";

interface Props {
  graph: StrainGraphType;
  /** When set, panel recommends strains similar to this one. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Reports the currently-recommended node ids so the graph can light them. */
  onRecommendations: (ids: Set<string>) => void;
  // Personal overlay — optional so the experimental 3D view (not kept at
  // parity) can omit it and keep the classic modes.
  /** Enables the "For me" mode once the profile is warm. */
  overlay?: Overlay | null;
  graphOverlay?: GraphOverlay | null;
  /** Called after a pick is added to the want-to-try list (owner only). */
  onWishlisted?: (strainKey: string) => void;
}

type Mode = "forMe" | "effects";

export function RecommendPanel({
  graph,
  selectedId,
  onSelect,
  onRecommendations,
  overlay = null,
  graphOverlay = null,
  onWishlisted = () => {},
}: Props) {
  const profileReady =
    !!overlay && !overlay.profile.coldStart && (overlay.profile.effects.length > 0 || overlay.profile.lineage.length > 0);
  const [modeChoice, setMode] = useState<Mode>("forMe");
  // Without a usable profile there's only the effect finder.
  const mode: Mode = profileReady ? modeChoice : "effects";
  // Effect-finder selections (only used when nothing is selected).
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // Side-effects to steer away from — applies in both seed and effect modes.
  const [avoid, setAvoid] = useState<Set<string>>(() => new Set());

  const effects = useMemo(() => allEffects(graph), [graph]);
  const negatives = useMemo(() => negativeEffects(graph), [graph]);

  const recs = useMemo<Recommendation[]>(() => {
    if (selectedId)
      return recommend(graph, { seedId: selectedId, avoid, limit: 6 });
    if (mode === "effects" && picked.size)
      return recommend(graph, { effects: picked, avoid, limit: 8 });
    return [];
  }, [graph, selectedId, picked, avoid, mode]);

  const forMe = useMemo<ProfileRecommendation[]>(() => {
    if (selectedId || mode !== "forMe" || !overlay || !graphOverlay) return [];
    return recommendForProfile(graph, overlay.profile, { tried: graphOverlay.triedKeys, limit: 8 });
  }, [graph, selectedId, mode, overlay, graphOverlay]);

  const recIds = useMemo(
    () => new Set([...recs.map((r) => r.id), ...forMe.map((r) => r.id)]),
    [recs, forMe],
  );
  useEffect(() => onRecommendations(recIds), [recIds, onRecommendations]);

  const seedLabel = selectedId
    ? graph.getNodeAttribute(selectedId, "label")
    : null;

  const toggleIn =
    (setter: typeof setPicked) => (effect: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(effect)) next.delete(effect);
        else next.add(effect);
        return next;
      });
  const togglePicked = toggleIn(setPicked);
  const toggleAvoid = toggleIn(setAvoid);

  if (!selectedId && mode === "forMe") {
    return (
      <div className="rounded-lg bg-zinc-900/90 p-4 text-sm shadow-lg backdrop-blur">
        <ModeTabs mode={mode} onChange={setMode} />
        <ForMeList
          recs={forMe}
          graph={graph}
          canWishlist={overlay?.isOwner ?? false}
          wishlist={graphOverlay?.wishlist ?? new Set()}
          onSelect={onSelect}
          onWishlisted={onWishlisted}
        />
      </div>
    );
  }

  const sessionsNeeded =
    overlay?.isOwner && overlay.profile.coldStart
      ? COLD_START_SESSIONS - Object.values(overlay.ratings).reduce((n, r) => n + r.sessions, 0)
      : 0;

  return (
    <div className="rounded-lg bg-zinc-900/90 p-4 text-sm shadow-lg backdrop-blur">
      {!selectedId && profileReady && <ModeTabs mode={mode} onChange={setMode} />}
      <p className="mb-2 font-medium text-zinc-200">
        {seedLabel ? (
          <>
            Similar to{" "}
            <span className="text-zinc-50">{seedLabel}</span>
          </>
        ) : (
          "Find by effect"
        )}
      </p>
      {!selectedId && sessionsNeeded > 0 && (
        <p className="mb-2 text-[11px] text-zinc-500">
          Log {sessionsNeeded} more session{sessionsNeeded === 1 ? "" : "s"} to unlock picks tuned to your taste.
        </p>
      )}

      {/* Effect picker — only when there's no seed strain. */}
      {!selectedId && (
        <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {effects.map((e) => {
            const on = picked.has(e);
            return (
              <button
                key={e}
                onClick={() => togglePicked(e)}
                className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${
                  on
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}

      {/* Avoid picker — steer away from side-effects, in either mode. */}
      {negatives.length > 0 && (selectedId || picked.size > 0) && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-600/80">
            Avoid
          </p>
          <div className="flex flex-wrap gap-1.5">
            {negatives.map((e) => {
              const on = avoid.has(e);
              return (
                <button
                  key={e}
                  onClick={() => toggleAvoid(e)}
                  className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${
                    on
                      ? "bg-amber-700 text-amber-50"
                      : "border border-amber-900/50 text-amber-600/80 hover:bg-amber-950/40"
                  }`}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recs.length === 0 ? (
        <p className="text-xs text-zinc-500">
          {selectedId
            ? "No similar strains found."
            : "Pick a few effects to see matches."}
        </p>
      ) : (
        <ul className="space-y-2">
          {recs.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onSelect(r.id)}
                className="w-full rounded-md p-2 text-left hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        TYPE_COLORS[
                          graph.getNodeAttribute(r.id, "strainType") as StrainType
                        ],
                    }}
                  />
                  <span className="flex-1 truncate text-zinc-100">{r.label}</span>
                  <ScoreBar value={r.score} />
                </div>

                {(r.sharedEffects.length > 0 || r.negatives.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-4.5">
                    {r.sharedEffects.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-zinc-800 px-1.5 text-[10px] capitalize text-emerald-300"
                      >
                        {e}
                      </span>
                    ))}
                    {r.negatives.map((e) => (
                      <span
                        key={e}
                        className={`rounded-full px-1.5 text-[10px] capitalize ${
                          avoid.has(e)
                            ? "bg-amber-800/60 text-amber-200 line-through"
                            : "bg-zinc-800/60 text-amber-600/80"
                        }`}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-1 pl-4.5 text-[10px] text-zinc-500">
                  {explain(r)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tab = (m: Mode, label: string) => (
    <button
      role="tab"
      aria-selected={mode === m}
      onClick={() => onChange(m)}
      className={`rounded-md px-2 py-0.5 text-xs ${
        mode === m ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div role="tablist" className="mb-3 flex gap-1">
      {tab("forMe", "For me")}
      {tab("effects", "By effect")}
    </div>
  );
}

/** Picks scored against my taste profile, with reasons + want-to-try. */
function ForMeList({
  recs,
  graph,
  canWishlist,
  wishlist,
  onSelect,
  onWishlisted,
}: {
  recs: ProfileRecommendation[];
  graph: StrainGraphType;
  canWishlist: boolean;
  wishlist: Set<string>;
  onSelect: (id: string) => void;
  onWishlisted: (strainKey: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  if (!recs.length) return <p className="text-xs text-zinc-500">No untried strains match your profile yet.</p>;

  const wish = (id: string) => {
    const key = graph.getNodeAttribute(id, "strainKey");
    startTransition(async () => {
      const res = await setWishlistedAction(key, true, undefined, "rec");
      if (res.ok) onWishlisted(key);
      else setFailed(id);
    });
  };

  return (
    <>
      <p className="mb-2 text-[11px] text-zinc-500">Untried strains that fit what you rate highly.</p>
      <ul className="space-y-2">
        {recs.map((r) => (
          <li key={r.id} className="rounded-md hover:bg-zinc-800/70">
            <div className="flex items-start gap-1 p-2">
              <button onClick={() => onSelect(r.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[graph.getNodeAttribute(r.id, "strainType") as StrainType] }}
                  />
                  <span className="flex-1 truncate text-zinc-100">{r.label}</span>
                  <ScoreBar value={r.score} />
                </div>
                {r.reasons.length > 0 && (
                  <p className="mt-1 pl-4.5 text-[10px] leading-snug text-zinc-500">{r.reasons.join(" · ")}</p>
                )}
              </button>
              {canWishlist &&
                (wishlist.has(r.id) ? (
                  <span className="shrink-0 px-1 text-[10px] text-emerald-400/90" title="On your want-to-try list">
                    ✓
                  </span>
                ) : (
                  <button
                    onClick={() => wish(r.id)}
                    disabled={pending}
                    title="Add to want-to-try"
                    aria-label={`Add ${r.label} to want-to-try`}
                    className="shrink-0 rounded px-1 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50"
                  >
                    {failed === r.id ? "!" : "+"}
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] leading-snug text-zinc-600">
        Pattern-matching on one person&apos;s ratings, not medical advice.
      </p>
    </>
  );
}

/** Terse plain-language "why" for a recommendation row. */
function explain(r: Recommendation): string {
  const parts: string[] = [];
  if (r.sharedEffects.length) {
    const n = r.sharedEffects.length;
    parts.push(`${n} shared effect${n > 1 ? "s" : ""}`);
  }
  if (r.commonAncestor) parts.push(`via ${r.commonAncestor.label}`);
  if (r.distance != null && r.distance > 0) {
    parts.push(`${r.distance} hop${r.distance > 1 ? "s" : ""} away`);
  }
  if (!parts.length) return r.driver === "lineage" ? "related lineage" : "effect match";
  return parts.join(" · ");
}

function ScoreBar({ value }: { value: number }) {
  return (
    <span
      className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800"
      title={`${Math.round(value * 100)}% match`}
    >
      <span
        className="block h-full rounded-full bg-emerald-500"
        style={{ width: `${Math.max(6, Math.round(value * 100))}%` }}
      />
    </span>
  );
}
