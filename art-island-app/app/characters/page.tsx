"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/Navbar";
import {
  CharacterDetail,
  type Memory,
  type Personality,
} from "@/app/components/CharacterDetail";
import type { RigAnimMode } from "@/app/components/AnimatedRigSprite";
import type { VersionStage } from "@/app/components/EvolutionTimeline";

interface CharacterData {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  islandId: number;
  isArchived?: boolean;
  rigPath?: string | null;
  joints?:
    | Partial<
        Record<
          | "head_top"
          | "neck"
          | "shl"
          | "shr"
          | "hipl"
          | "hipr"
          | "footl"
          | "footr",
          { x: number; y: number }
        >
      >
    | null;
  riggedAt?: string | Date | null;
  animationPreference?: "auto" | RigAnimMode;
  memories?: Memory[];
  personality?: Personality | null;
  versionHistory?: VersionStage[];
}

interface IslandData {
  id: number;
  label: string;
}

export default function AllCharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [islands, setIslands] = useState<IslandData[]>([]);
  const [selected, setSelected] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCharacterId, setBusyCharacterId] = useState<string | null>(null);
  const [restoreTargets, setRestoreTargets] = useState<Record<string, number>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const activeIslandIds = useMemo(() => new Set(islands.map((i) => i.id)), [islands]);

  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    setDarkMode(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [charactersRes, islandsRes] = await Promise.all([
          fetch("/api/characters"),
          fetch("/api/islands"),
        ]);
        if (charactersRes.status === 401 || islandsRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!charactersRes.ok || !islandsRes.ok) throw new Error("Failed to load characters");
        const [charactersData, islandsData]: [CharacterData[], IslandData[]] = await Promise.all([
          charactersRes.json(),
          islandsRes.json(),
        ]);
        setCharacters(charactersData);
        setIslands(islandsData);
      } catch {
        setError("Could not load characters. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  const updateCharacter = (id: string, patch: Partial<CharacterData>) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const archiveCharacter = async (character: CharacterData) => {
    try {
      setBusyCharacterId(character.id);
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive-from-island", characterId: character.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to remove from island");
      updateCharacter(character.id, { isArchived: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove from island.");
    } finally {
      setBusyCharacterId(null);
    }
  };

  const restoreCharacter = async (character: CharacterData, islandId: number) => {
    try {
      setBusyCharacterId(character.id);
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore-to-island", characterId: character.id, islandId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to restore character");
      updateCharacter(character.id, { isArchived: false, islandId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to restore character.");
    } finally {
      setBusyCharacterId(null);
    }
  };

  const handleBulkRemove = async () => {
    if (!window.confirm(`Remove ${selectedIds.size} character${selectedIds.size > 1 ? "s" : ""} from island?`)) return;
    setBulkBusy(true);
    for (const id of selectedIds) {
      const char = characters.find((c) => c.id === id);
      if (char && !char.isArchived) await archiveCharacter(char);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkBusy(false);
  };

  const toggleSelectMode = () => {
    setSelectMode((p) => !p);
    setSelectedIds(new Set());
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const anySelectedOnIsland = [...selectedIds].some(
    (id) => !characters.find((c) => c.id === id)?.isArchived
  );

  const bg = darkMode ? "#0f2336" : "#ffffff";
  const text = darkMode ? "#f0f6ff" : "#1a1a1a";
  const textMuted = darkMode ? "#7ea8c4" : "#888780";
  const border = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <p style={{ color: textMuted, fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg }}>
      <Navbar
        title={selected ? `Character: ${selected.name}` : "All Characters"}
        subtitle={
          selected
            ? "Open view to rig, evolve, chat, and manage island visibility."
            : "Select a character to open Character View."
        }
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode((p) => !p)}
        showBackButton={true}
      />

      <div className="pt-20 p-6 max-w-6xl mx-auto">
        {error && (
          <p className="text-sm mb-4" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <p style={{ color: textMuted, fontSize: 12 }}>
            {characters.length} {characters.length === 1 ? "character" : "characters"}
            {selectMode && selectedIds.size > 0 && (
              <span style={{ color: text }}> · {selectedIds.size} selected</span>
            )}
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {selectMode && selectedIds.size > 0 && anySelectedOnIsland && (
              <button
                onClick={() => void handleBulkRemove()}
                disabled={bulkBusy}
                style={{
                  fontSize: 12,
                  color: "#ef4444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  opacity: bulkBusy ? 0.5 : 1,
                }}
              >
                {bulkBusy ? "Removing…" : "Remove from island"}
              </button>
            )}
            <button
              onClick={toggleSelectMode}
              style={{
                fontSize: 12,
                color: textMuted,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>
        </div>

        {characters.length === 0 ? (
          <p style={{ color: textMuted, fontSize: 13, textAlign: "center", paddingTop: 60 }}>
            No characters yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6">
            {characters.map((character) => {
              const onIsland = !character.isArchived;
              const isChecked = selectedIds.has(character.id);
              const busy = busyCharacterId === character.id;
              const restoreIslandId =
                restoreTargets[character.id] ??
                (activeIslandIds.has(character.islandId) ? character.islandId : islands[0]?.id);

              return (
                <div
                  key={character.id}
                  onClick={() => (selectMode ? toggleId(character.id) : setSelected(character))}
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  {/* Image */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: `1px solid ${border}`,
                      backgroundColor: bg,
                      position: "relative",
                    }}
                  >
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                        opacity: isChecked ? 0.6 : 1,
                      }}
                    />

                    {selectMode && (
                      <div
                        style={{
                          position: "absolute",
                          top: 7,
                          right: 7,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: `1.5px solid ${isChecked ? text : textMuted}`,
                          backgroundColor: isChecked ? text : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isChecked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4l2 2 3-3.5" stroke={bg} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div style={{ paddingTop: 6, paddingLeft: 1 }}>
                    <p style={{ color: text, fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.3 }}>
                      {character.name}
                    </p>
                    <p style={{ color: textMuted, fontSize: 11, margin: "2px 0 0" }}>
                      Age {character.age}
                      {!onIsland && <span style={{ marginLeft: 5, color: "#f59e0b" }}>· removed</span>}
                    </p>

                    {/* Restore row for archived characters */}
                    {!selectMode && !onIsland && islands.length > 0 && (
                      <div
                        style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={restoreIslandId ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            setRestoreTargets((prev) => ({
                              ...prev,
                              [character.id]: Number(e.target.value),
                            }))
                          }
                          style={{
                            flex: 1,
                            fontSize: 11,
                            background: bg,
                            color: text,
                            border: `1px solid ${border}`,
                            borderRadius: 5,
                            padding: "3px 5px",
                            outline: "none",
                          }}
                        >
                          {islands.map((i) => (
                            <option key={i.id} value={i.id}>{i.label || `Island ${i.id}`}</option>
                          ))}
                        </select>
                        <button
                          disabled={busy || !restoreIslandId}
                          onClick={() => restoreIslandId && void restoreCharacter(character, restoreIslandId)}
                          style={{
                            fontSize: 11,
                            color: textMuted,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            opacity: busy || !restoreIslandId ? 0.4 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {busy ? "…" : "Restore"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <CharacterDetail
          id={selected.id}
          name={selected.name}
          age={selected.age}
          imageUrl={selected.imageUrl}
          islandId={selected.islandId}
          rigPath={selected.rigPath ?? null}
          joints={selected.joints ?? null}
          riggedAt={selected.riggedAt ?? null}
          animationPreference={selected.animationPreference ?? "auto"}
          memories={selected.memories ?? []}
          personality={selected.personality ?? null}
          versionHistory={selected.versionHistory ?? []}
          onClose={() => setSelected(null)}
          onRigGenerated={(updated) => {
            updateCharacter(updated.id, { rigPath: updated.rigPath, riggedAt: updated.riggedAt });
          }}
          onAnimationUpdated={(updated) => {
            updateCharacter(updated.id, { animationPreference: updated.animationPreference });
          }}
          onRemoveFromIsland={
            selected.isArchived ? undefined : async () => { await archiveCharacter(selected); }
          }
          onEvolved={(updated) => {
            updateCharacter(updated.id, {
              imageUrl: updated.imageUrl,
              versionHistory: updated.versionHistory,
              memories: updated.memories,
              personality: updated.personality,
            });
          }}
        />
      )}
    </div>
  );
}