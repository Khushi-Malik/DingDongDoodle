"use client";

import { useState } from "react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VersionStage {
  imageUrl: string;
  stage: number;
  label: string;
  createdAt: string | Date;
}

interface EvolutionTimelineProps {
  characterName: string;
  currentImageUrl: string;
  versionHistory: VersionStage[];  // all stages INCLUDING current
  onClose?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EvolutionTimeline({
  characterName,
  currentImageUrl,
  versionHistory,
  onClose,
}: EvolutionTimelineProps) {
  const [selected, setSelected] = useState<VersionStage | null>(null);

  // Build the full ordered list. If versionHistory is populated use it directly.
  // Always ensure the latest stage uses the live currentImageUrl.
  const stages: VersionStage[] = versionHistory.length > 0
    ? versionHistory.map((v, i) =>
        i === versionHistory.length - 1
          ? { ...v, imageUrl: currentImageUrl }   // keep latest in sync
          : v
      )
    : [{ imageUrl: currentImageUrl, stage: 1, label: "Stage 1", createdAt: new Date() }];

  const latest = stages[stages.length - 1];

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
        <div>
          <h2 className="font-serif text-lg font-bold text-stone-900 leading-tight">
            {characterName}&apos;s Evolution
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {stages.length} stage{stages.length !== 1 ? "s" : ""} · all versions preserved
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: stage list ──────────────────────────────────────────── */}
        <div className="w-64 border-r border-stone-100 overflow-y-auto shrink-0 py-3">
          {stages.map((stage, idx) => {
            const isLatest = idx === stages.length - 1;
            const isSelected = selected?.stage === stage.stage;
            return (
              <button
                key={stage.stage}
                type="button"
                onClick={() => setSelected(isSelected ? null : stage)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-amber-50 border-r-2 border-amber-400"
                    : "hover:bg-stone-50"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                  <Image src={stage.imageUrl} alt={stage.label} fill className="object-contain" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-semibold truncate ${
                      isSelected ? "text-amber-800" : "text-stone-800"
                    }`}>
                      {stage.label}
                    </p>
                    {isLatest && (
                      <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {formatDate(stage.createdAt)}
                  </p>
                </div>

                {/* Arrow */}
                {!isLatest && (
                  <div className="shrink-0 text-stone-300 text-xs">›</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: detail pane ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5">
          {selected ? (
            <StageDetail stage={selected} isLatest={selected.stage === latest.stage} />
          ) : (
            <TimelineView stages={stages} onSelect={setSelected} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Timeline overview (default when nothing selected) ───────────────────────

function TimelineView({ stages, onSelect }: {
  stages: VersionStage[];
  onSelect: (s: VersionStage) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-stone-400">
        Click any stage to inspect it, or compare them side-by-side below.
      </p>

      {/* Side-by-side strip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const isLatest = idx === stages.length - 1;
          return (
            <button
              key={stage.stage}
              type="button"
              onClick={() => onSelect(stage)}
              className="shrink-0 group flex flex-col items-center gap-1.5"
            >
              <div className={`relative w-24 h-24 rounded-xl border-2 overflow-hidden bg-stone-50 transition-all group-hover:scale-105 ${
                isLatest ? "border-amber-400 shadow-md" : "border-stone-200"
              }`}>
                <Image src={stage.imageUrl} alt={stage.label} fill className="object-contain" />
                {isLatest && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-amber-400 w-2.5 h-2.5" />
                )}
              </div>
              <p className="text-[11px] font-medium text-stone-600 group-hover:text-amber-700 transition-colors">
                {stage.label}
              </p>
              <p className="text-[10px] text-stone-400">{formatDate(stage.createdAt)}</p>
            </button>
          );
        })}
      </div>

      {/* Evolution arrow diagram */}
      {stages.length > 1 && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-semibold text-stone-500 mb-3 uppercase tracking-widest">
            Growth path
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {stages.map((stage, idx) => (
              <div key={stage.stage} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div className="relative w-14 h-14 rounded-lg border border-stone-300 overflow-hidden bg-white">
                    <Image src={stage.imageUrl} alt={stage.label} fill className="object-contain" />
                  </div>
                  <span className="text-[10px] text-stone-500">{stage.label}</span>
                </div>
                {idx < stages.length - 1 && (
                  <span className="text-stone-400 text-sm shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single stage detail ──────────────────────────────────────────────────────

function StageDetail({ stage, isLatest }: { stage: VersionStage; isLatest: boolean }) {
  return (
    <div className="space-y-4">
      {/* Full image */}
      <div className={`relative rounded-2xl overflow-hidden border-2 bg-stone-50 ${
        isLatest ? "border-amber-400" : "border-stone-200"
      }`} style={{ aspectRatio: "1 / 1", maxWidth: 320, margin: "0 auto" }}>
        <Image src={stage.imageUrl} alt={stage.label} fill className="object-contain p-4" />
        {isLatest && (
          <span className="absolute top-3 right-3 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-stone-900">
            Current
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
        <Row label="Stage" value={String(stage.stage)} />
        <Row label="Name" value={stage.label} />
        <Row label="Created" value={formatDate(stage.createdAt)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-sm font-medium text-stone-800">{value}</p>
    </div>
  );
}