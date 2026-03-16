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
  const [restoreTargets, setRestoreTargets] = useState<Record<string, number>>(
    {},
  );
  const [darkMode, setDarkMode] = useState(false);

  const activeIslandIds = useMemo(
    () => new Set(islands.map((i) => i.id)),
    [islands],
  );

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

        if (!charactersRes.ok || !islandsRes.ok) {
          throw new Error("Failed to load characters");
        }

        const [charactersData, islandsData]: [CharacterData[], IslandData[]] =
          await Promise.all([charactersRes.json(), islandsRes.json()]);

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
    if (!window.confirm(`Remove ${character.name} from island?`)) return;

    try {
      setBusyCharacterId(character.id);
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive-from-island",
          characterId: character.id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to remove from island");
      }

      updateCharacter(character.id, { isArchived: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove from island.");
    } finally {
      setBusyCharacterId(null);
    }
  };

  const restoreCharacter = async (character: CharacterData) => {
    const fallbackIslandId = islands[0]?.id;
    const requestedIslandId =
      restoreTargets[character.id] ?? character.islandId ?? fallbackIslandId;

    if (!requestedIslandId) {
      alert("Create an island first, then restore this character.");
      return;
    }

    try {
      setBusyCharacterId(character.id);
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore-to-island",
          characterId: character.id,
          islandId: requestedIslandId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to restore character");
      }

      updateCharacter(character.id, {
        isArchived: false,
        islandId: requestedIslandId,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to restore character.");
    } finally {
      setBusyCharacterId(null);
    }
  };

  const bgColor = darkMode ? "#0f2336" : "#ffffff";
  const textMain = darkMode ? "#f0f6ff" : "#1a1a1a";
  const textMuted = darkMode ? "#7ea8c4" : "#888780";
  const borderColor = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const hoverBg = darkMode ? "rgba(255,255,255,0.05)" : "#f3f4f6";

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <p style={{ color: textMuted }}>Loading characters...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
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
          <div
            className="rounded-xl border px-4 py-3 text-sm mb-4"
            style={{
              borderColor: darkMode ? "rgba(248,113,113,0.3)" : "#fecaca",
              backgroundColor: darkMode ? "rgba(127,29,29,0.2)" : "#fee2e2",
              color: darkMode ? "#fca5a5" : "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        <p className="text-sm mb-4" style={{ color: textMuted }}>
          {characters.length} {characters.length === 1 ? "character" : "characters"}
        </p>

        {characters.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed py-16 text-center"
            style={{ borderColor }}
          >
            <p style={{ color: textMuted }}>No characters found yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {characters.map((character) => {
              const onIsland = !character.isArchived;
              const hasOriginalIsland = activeIslandIds.has(character.islandId);
              const selectedRestoreIslandId =
                restoreTargets[character.id] ??
                (hasOriginalIsland ? character.islandId : islands[0]?.id);
              const busy = busyCharacterId === character.id;

              return (
                <button
                  type="button"
                  key={character.id}
                  onClick={() => setSelected(character)}
                  className="group flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-left"
                  style={{
                    borderColor:
                      selected?.id === character.id
                        ? "rgba(96, 165, 250, 0.6)"
                        : "transparent",
                    opacity: onIsland ? 1 : 0.86,
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.id !== character.id) {
                      e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.5)";
                    }
                    e.currentTarget.style.backgroundColor = darkMode
                      ? "rgba(59, 130, 246, 0.1)"
                      : "#eff6ff";
                  }}
                  onMouseLeave={(e) => {
                    if (selected?.id !== character.id) {
                      e.currentTarget.style.borderColor = "transparent";
                    }
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div
                    className="w-full aspect-square rounded-lg overflow-hidden border"
                    style={{
                      backgroundColor: hoverBg,
                      borderColor,
                    }}
                  >
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="w-full">
                    <p className="text-sm font-medium truncate" style={{ color: textMain }}>
                      {character.name}
                    </p>
                    <p className="text-xs" style={{ color: textMuted }}>
                      Age {character.age}
                    </p>
                    <p
                      className="text-[11px] mt-1 font-medium"
                      style={{ color: onIsland ? "#22c55e" : "#f59e0b" }}
                    >
                      {onIsland ? "On island" : "Removed"}
                    </p>
                  </div>

                  <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                    {onIsland ? (
                      <button
                        type="button"
                        onClick={() => void archiveCharacter(character)}
                        disabled={busy}
                        className="w-full rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: "#ef4444",
                          color: "#fff",
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busy ? "Removing..." : "Remove"}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <select
                          value={selectedRestoreIslandId ?? ""}
                          disabled={busy || islands.length === 0}
                          onChange={(e) =>
                            setRestoreTargets((prev) => ({
                              ...prev,
                              [character.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded-lg border px-2 py-1.5 text-xs"
                          style={{
                            borderColor,
                            backgroundColor: darkMode ? "#0f2336" : "#fff",
                            color: textMain,
                          }}
                        >
                          {islands.map((island) => (
                            <option key={island.id} value={island.id}>
                              {island.label || `Island ${island.id}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void restoreCharacter(character)}
                          disabled={busy || islands.length === 0 || !selectedRestoreIslandId}
                          className="w-full rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: darkMode ? "#1e3a52" : "#111827",
                            color: "#fff",
                            opacity:
                              busy || islands.length === 0 || !selectedRestoreIslandId
                                ? 0.6
                                : 1,
                          }}
                        >
                          {busy ? "Restoring..." : "Bring back"}
                        </button>
                      </div>
                    )}
                  </div>
                </button>
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
            updateCharacter(updated.id, {
              rigPath: updated.rigPath,
              riggedAt: updated.riggedAt,
            });
          }}
          onAnimationUpdated={(updated) => {
            updateCharacter(updated.id, {
              animationPreference: updated.animationPreference,
            });
          }}
          onRemoveFromIsland={
            selected.isArchived
              ? undefined
              : async () => {
                  await archiveCharacter(selected);
                }
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
