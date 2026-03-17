"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { EvolutionTimeline, VersionStage } from "./EvolutionTimeline";
import JointEditor from "@/app/components/JointEditor";
import { DrawingCanvas } from "./DrawingCanvas";
import { AnimatedRigSprite, RigAnimMode } from "./AnimatedRigSprite";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  text: string;
  createdAt?: string;
}

export interface Personality {
  catchphrase?: string;
  traits?: string[];
  dailyActivity?: string;
  favoriteThing?: string;
}

export interface CharacterDetailProps {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  rigPath?: string | null;
  joints?: Partial<Record<"head_top" | "neck" | "shl" | "shr" | "hipl" | "hipr" | "footl" | "footr", { x: number; y: number }>> | null;
  riggedAt?: string | Date | null;
  animationPreference?: "auto" | RigAnimMode;
  islandId: number;
  memories?: Memory[];
  personality?: Personality | null;
  versionHistory?: VersionStage[];
  onClose: () => void;
  onRigGenerated?: (updated: { id: string; rigPath: string; riggedAt: string }) => void;
  onJointsUpdated?: (updated: { id: string; joints: Record<string, { x: number; y: number }>; riggedAt: string }) => void;
  onAnimationUpdated?: (updated: { id: string; animationPreference: "auto" | RigAnimMode }) => void;
  islandRigEnabled?: boolean;
  onIslandRigToggle?: (enabled: boolean) => void;
  onRemoveFromIsland?: () => void | Promise<void>;
  onEvolved?: (updated: { id: string; imageUrl: string; versionHistory: VersionStage[]; memories: Memory[]; personality: Personality | null }) => void;
}

type Tab        = "info" | "memories" | "evolution";
type EvolveStep = "idle" | "choose" | "draw" | "rig" | "saving";
type ChatRole   = "user" | "assistant";
type ChatMessage = { role: ChatRole; text: string };

const ANIMATION_OPTIONS: Array<{ key: "auto" | RigAnimMode; label: string }> = [
  { key: "auto",  label: "Auto roam" },
  { key: "idle",  label: "Idle" },
  { key: "walk",  label: "Walk" },
  { key: "hop",   label: "Hop" },
  { key: "wave",  label: "Wave" },
  { key: "run",   label: "Run" },
  { key: "dance", label: "Dance" },
  { key: "sleep", label: "Sleep" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CharacterDetail({
  id,
  name,
  age,
  imageUrl:       initialImageUrl,
  rigPath,
  joints,
  riggedAt,
  animationPreference = "auto",
  memories:       initialMemories   = [],
  personality:    initialPersonality,
  versionHistory: initialHistory    = [],
  onClose,
  onRigGenerated,
  onJointsUpdated,
  onAnimationUpdated,
  islandRigEnabled = false,
  onIslandRigToggle,
  onRemoveFromIsland,
  onEvolved,
}: CharacterDetailProps) {
  const [tab, setTab]                 = useState<Tab>("info");
  const [evolveStep, setEvolveStep]   = useState<EvolveStep>("idle");
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [evolveError, setEvolveError] = useState<string | null>(null);
  const [memoryNote, setMemoryNote]   = useState("");

  const [liveImageUrl,            setLiveImageUrl]            = useState(initialImageUrl);
  const [liveHistory,             setLiveHistory]             = useState<VersionStage[]>(initialHistory);
  const [liveMemories,            setLiveMemories]            = useState<Memory[]>(initialMemories);
  const [livePersonality,         setLivePersonality]         = useState<Personality | null>(initialPersonality ?? null);
  const [chatInput,               setChatInput]               = useState("");
  const [chatBusy,                setChatBusy]                = useState(false);
  const [liveRigPath,             setLiveRigPath]             = useState<string | null>(rigPath ?? null);
  const [liveJoints,              setLiveJoints]              = useState(joints ?? null);
  const [liveRiggedAt,            setLiveRiggedAt]            = useState<string | Date | null>(riggedAt ?? null);
  const [liveAnimationPreference, setLiveAnimationPreference] = useState<"auto" | RigAnimMode>(animationPreference);
  const [animationBusy,           setAnimationBusy]           = useState(false);
  const [rigBusy,                 setRigBusy]                 = useState(false);
  const [manualRigBusy,           setManualRigBusy]           = useState(false);
  const [manualRigOpen,           setManualRigOpen]           = useState(false);
  const [removingFromIsland,      setRemovingFromIsland]      = useState(false);
  const [rigMessage,              setRigMessage]              = useState<string | null>(null);

  const favoriteForQuote = useMemo(() => {
    if (livePersonality?.favoriteThing?.trim()) return livePersonality.favoriteThing.trim();
    if (livePersonality?.traits?.length)        return livePersonality.traits[0];
    if (liveMemories.length > 0)                return liveMemories[liveMemories.length - 1].text;
    return "new adventures";
  }, [livePersonality, liveMemories]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Hi! I am ${name}. And I like ${favoriteForQuote}. How are you?!` },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageCount   = liveHistory.length;
  const previewMode: RigAnimMode = liveAnimationPreference === "auto" ? "wave" : liveAnimationPreference;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const cancelEvolve = () => {
    setEvolveStep("idle"); setNewImageUrl(null); setEvolveError(null); setMemoryNote("");
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await fetch("/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: { id, name, age, memories: liveMemories, personality: livePersonality, versionHistory: liveHistory }, messages: nextMessages }),
      });
      if (!res.ok) { const p = await res.json().catch(() => null); throw new Error(p?.error || "Could not chat."); }
      const payload = await res.json();
      const reply = String(payload?.reply || "").trim();
      if (!reply) throw new Error("No response.");
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      const memoryCandidate = String(payload?.memoryCandidate || "").trim();
      if (memoryCandidate.length > 0) {
        const memoryRes = await fetch("/api/characters", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", characterId: id, memory: { id: crypto.randomUUID(), text: memoryCandidate } }),
        });
        if (memoryRes.ok) {
          const updated = await memoryRes.json();
          if (Array.isArray(updated?.memories)) setLiveMemories(updated.memories as Memory[]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: `Sorry, I got shy for a moment: ${message}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  const generateRig = async () => {
    if (rigBusy) return;
    setRigBusy(true); setRigMessage(null);
    try {
      const res = await fetch("/api/rig/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: id }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Rig generation failed");
      const generatedPath = String(payload?.rigPath || "").trim();
      const riggedAtValue = String(payload?.riggedAt || new Date().toISOString());
      if (!generatedPath) throw new Error("No rigPath returned");
      const refreshedPath = `${generatedPath}?v=${Date.now()}`;
      setLiveRigPath(refreshedPath); setLiveRiggedAt(riggedAtValue);
      setRigMessage("Rig generated.");
      onRigGenerated?.({ id, rigPath: refreshedPath, riggedAt: riggedAtValue });
    } catch (err) {
      setRigMessage(err instanceof Error ? err.message : "Rig generation failed.");
    } finally { setRigBusy(false); }
  };

  const updateAnimationPreference = async (next: "auto" | RigAnimMode) => {
    if (animationBusy || next === liveAnimationPreference) return;
    setAnimationBusy(true); setRigMessage(null);
    try {
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-animation", characterId: id, animationPreference: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Could not update animation");
      const confirmed = String(payload?.animationPreference || next) as "auto" | RigAnimMode;
      setLiveAnimationPreference(confirmed);
      onAnimationUpdated?.({ id, animationPreference: confirmed });
    } catch (err) {
      setRigMessage(err instanceof Error ? err.message : "Could not update animation.");
    } finally { setAnimationBusy(false); }
  };

  const removeFromIsland = async () => {
    if (!onRemoveFromIsland || removingFromIsland) return;
    setRemovingFromIsland(true);
    try { await onRemoveFromIsland(); } finally { setRemovingFromIsland(false); }
  };

  const handleManualRigConfirm = async (nextJoints: Record<string, { x: number; y: number }>) => {
    if (manualRigBusy) return;
    setManualRigBusy(true); setRigMessage(null);
    try {
      const res = await fetch("/api/rig", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: id, joints: nextJoints }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save rig points");
      const riggedAtValue = new Date().toISOString();
      setLiveJoints(nextJoints); setLiveRiggedAt(riggedAtValue);
      setManualRigOpen(false); setRigMessage("Rig points updated.");
      onJointsUpdated?.({ id, joints: nextJoints, riggedAt: riggedAtValue });
    } catch (err) {
      setRigMessage(err instanceof Error ? err.message : "Failed to save rig points.");
    } finally { setManualRigBusy(false); }
  };

  const handleRigConfirm = async (joints: Record<string, { x: number; y: number }>) => {
    if (!newImageUrl) return;
    setEvolveStep("saving"); setEvolveError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evolve", characterId: id, imageUrl: newImageUrl, joints, memoryText: memoryNote.trim() || undefined }),
      });
      if (!res.ok) { const p = await res.json().catch(() => null); throw new Error(p?.error ?? "Evolve failed"); }
      const updated = await res.json();
      setLiveImageUrl(updated.imageUrl); setLiveHistory(updated.versionHistory ?? []);
      setLiveMemories(updated.memories ?? []); setLivePersonality(updated.personality ?? null);
      onEvolved?.({ id: updated.id, imageUrl: updated.imageUrl, versionHistory: updated.versionHistory ?? [], memories: updated.memories ?? [], personality: updated.personality ?? null });
      setEvolveStep("idle"); setNewImageUrl(null); setMemoryNote(""); setTab("evolution");
    } catch (err) {
      setEvolveError(err instanceof Error ? err.message : "Evolve failed");
      setEvolveStep("rig");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {evolveStep === "draw" && (
        <div className="fixed inset-0 z-60">
          <DrawingCanvas
            onSave={(dataUrl) => { setNewImageUrl(dataUrl); setEvolveStep("rig"); }}
            onClose={() => setEvolveStep("choose")}
            tutorialHint={`Draw ${name}'s evolved form ✨`}
          />
        </div>
      )}

      <input
        ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setNewImageUrl(await readFile(file));
          setEvolveStep("rig");
          e.target.value = "";
        }}
      />

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
        onClick={evolveStep === "idle" && !manualRigOpen ? onClose : undefined}
      >
        <motion.div
          initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="bg-white rounded-2xl border border-stone-200 w-full overflow-hidden flex flex-col"
          style={{
            maxWidth:  evolveStep === "rig" ? 760 : 680,
            height:    "min(92vh, 52rem)",
            maxHeight: "92vh",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">

            {/* ── Choose: draw or upload ──────────────────────────────────── */}
            {evolveStep === "choose" && (
              <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                <ModalHeader title={`Evolve ${name}`} sub="Choose how to create the next stage" onBack={cancelEvolve} />
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="flex justify-center">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">
                        Current — Stage {stageCount || 1}
                      </p>
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 mx-auto">
                        <Image src={liveImageUrl} alt="current" fill className="object-contain p-2" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setEvolveStep("draw")}
                      className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors py-6">
                      <span className="text-2xl">✏️</span>
                      <p className="text-sm font-medium text-stone-700">Draw it</p>
                      <p className="text-xs text-stone-400">Open the canvas</p>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors py-6">
                      <span className="text-2xl">📁</span>
                      <p className="text-sm font-medium text-stone-700">Upload a file</p>
                      <p className="text-xs text-stone-400">PNG, JPG, GIF</p>
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                      What changed? <span className="font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      value={memoryNote}
                      onChange={(e) => setMemoryNote(e.target.value)}
                      placeholder={`e.g. ${name} learned to fly today`}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Rig joints ─────────────────────────────────────────────── */}
            {(evolveStep === "rig" || evolveStep === "saving") && newImageUrl && (
              <motion.div key="rig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                <ModalHeader
                  title="Place joints"
                  sub={`Mark ${name}'s joints for stage ${(stageCount || 1) + 1}`}
                  onBack={() => { setNewImageUrl(null); setEvolveStep("choose"); }}
                />
                {evolveError && (
                  <p className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{evolveError}</p>
                )}
                <div className="flex-1 overflow-hidden p-4">
                  {evolveStep === "saving" ? (
                    <div className="flex items-center justify-center h-full gap-2">
                      <Spinner /><p className="text-sm text-stone-400">Saving evolution…</p>
                    </div>
                  ) : (
                    <JointEditor imageUrl={newImageUrl} onConfirm={handleRigConfirm} onBack={() => { setNewImageUrl(null); setEvolveStep("choose"); }} />
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Manual rig ─────────────────────────────────────────────── */}
            {evolveStep === "idle" && manualRigOpen && (
              <motion.div key="manual-rig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                <ModalHeader title="Rig again manually" sub={`Place joints for ${name}`} onBack={() => setManualRigOpen(false)} />
                {rigMessage && <p className="mx-5 mt-3 text-xs text-stone-500">{rigMessage}</p>}
                <div className="flex-1 overflow-hidden p-4">
                  {manualRigBusy ? (
                    <div className="flex items-center justify-center h-full gap-2"><Spinner /><p className="text-sm text-stone-400">Saving…</p></div>
                  ) : (
                    <JointEditor imageUrl={liveImageUrl} onConfirm={handleManualRigConfirm} onBack={() => setManualRigOpen(false)} />
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Normal view ────────────────────────────────────────────── */}
            {evolveStep === "idle" && !manualRigOpen && (
              <motion.div key="normal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">

                {/* Tab bar */}
                <div className="flex items-center border-b border-stone-200 px-1 pt-1 shrink-0">
                  <TabBtn active={tab === "info"} onClick={() => setTab("info")}>Info</TabBtn>
                  <TabBtn active={tab === "memories"} onClick={() => setTab("memories")}>
                    Memories {liveMemories.length > 0 && <Pill n={liveMemories.length} />}
                  </TabBtn>
                  <TabBtn active={tab === "evolution"} onClick={() => setTab("evolution")}>
                    Evolution {stageCount > 0 && <Pill n={stageCount} amber />}
                  </TabBtn>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setEvolveStep("choose")}
                    className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-semibold text-stone-900 transition-colors"
                  >
                    ✨ Evolve
                  </button>
                  <button type="button" onClick={onClose} className="mr-3 text-stone-400 hover:text-stone-600 text-xl leading-none transition">
                    ×
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">

                  {/* ── Info ──────────────────────────────────────────────── */}
                  {tab === "info" && (
                    <div className="h-full overflow-y-auto overscroll-contain">
                      {/* Two-column layout */}
                      <div className="flex min-h-full divide-x divide-stone-100">

                        {/* ── LEFT: Sprite + name + all buttons ── */}
                        <div className="w-48 shrink-0 flex flex-col gap-4 p-4">

                          {/* Sprite */}
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-stone-200 bg-stone-50">
                              <AnimatedRigSprite
                                imageUrl={liveImageUrl}
                                rigPath={liveRigPath}
                                joints={liveJoints}
                                riggedAt={liveRiggedAt}
                                name={name}
                                mode={previewMode}
                                direction={1}
                                frameSizePx={120}
                              />
                              {stageCount > 0 && (
                                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-stone-900">
                                  Lv {stageCount}
                                </span>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="font-serif text-base font-bold text-stone-900 leading-tight">{name}</p>
                              <p className="text-xs text-stone-400 mt-0.5">Age {age}</p>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-stone-100" />

                          {/* Animation dropdown */}
                          <div>
                            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1.5">Animation</p>
                            <select
                              value={liveAnimationPreference}
                              disabled={animationBusy}
                              onChange={(e) => void updateAnimationPreference(e.target.value as "auto" | RigAnimMode)}
                              className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:outline-none focus:border-stone-400 disabled:opacity-50"
                            >
                              {ANIMATION_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-stone-100" />

                          {/* Action buttons — full width, stacked */}
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setEvolveStep("choose")}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 px-3 py-2 text-xs font-semibold text-stone-900 transition-colors"
                            >
                              ✨ Evolve character
                            </button>

                            <button
                              type="button"
                              onClick={() => void generateRig()}
                              disabled={rigBusy}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-stone-600 transition-colors"
                            >
                              {rigBusy ? "Generating…" : liveRigPath ? "Regenerate rig" : "Generate rig"}
                            </button>

                            <button
                              type="button"
                              onClick={() => setManualRigOpen(true)}
                              disabled={manualRigBusy}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors"
                            >
                              {manualRigBusy ? "Saving…" : liveJoints ? "Re-rig manually" : "Set rig manually"}
                            </button>

                            {onIslandRigToggle && (
                              <button
                                type="button"
                                onClick={() => onIslandRigToggle(!islandRigEnabled)}
                                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                                  islandRigEnabled
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                                }`}
                              >
                                {islandRigEnabled ? "Classic on island" : "Use rig on island"}
                              </button>
                            )}

                            {onRemoveFromIsland && (
                              <button
                                type="button"
                                onClick={() => void removeFromIsland()}
                                disabled={removingFromIsland}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors"
                              >
                                {removingFromIsland ? "Removing…" : "Remove from island"}
                              </button>
                            )}

                            {stageCount > 1 && (
                              <button
                                type="button"
                                onClick={() => setTab("evolution")}
                                className="w-full text-xs text-stone-400 hover:text-stone-600 font-medium transition text-center py-1"
                              >
                                View {stageCount} stages →
                              </button>
                            )}
                          </div>

                          {rigMessage && (
                            <p className="text-[11px] text-stone-400 text-center">{rigMessage}</p>
                          )}
                        </div>

                        {/* ── RIGHT: Personality + quote + chat ── */}
                        <div className="flex-1 min-w-0 flex flex-col gap-4 p-4 overflow-y-auto">

                          {/* Personality */}
                          {livePersonality && (
                            <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                              {livePersonality.catchphrase && (
                                <InfoRow label="Catchphrase">
                                  <span className="italic">&ldquo;{livePersonality.catchphrase}&rdquo;</span>
                                </InfoRow>
                              )}
                              {livePersonality.traits && livePersonality.traits.length > 0 && (
                                <div className="px-4 py-3">
                                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">Traits</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {livePersonality.traits.map((t) => (
                                      <span key={t} className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-600">{t}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {livePersonality.dailyActivity && (
                                <InfoRow label="Daily activity">{livePersonality.dailyActivity}</InfoRow>
                              )}
                              {livePersonality.favoriteThing && (
                                <InfoRow label="Favourite thing">{livePersonality.favoriteThing}</InfoRow>
                              )}
                            </div>
                          )}

                          {/* Quote banner */}
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-sm text-stone-700 leading-snug">
                              <span className="font-semibold text-amber-800">Hi! I am {name}. </span>
                              And I like{" "}
                              <span className="font-semibold text-amber-800">{favoriteForQuote}</span>. How are you?!
                            </p>
                          </div>

                          {/* Chat */}
                          <div className="rounded-xl border border-stone-200 overflow-hidden flex flex-col">
                            <div className="border-b border-stone-100 px-4 py-2.5 shrink-0">
                              <p className="text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
                                Chat with {name}
                              </p>
                            </div>
                            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-stone-50" style={{ maxHeight: 220 }}>
                              {chatMessages.map((m, i) => (
                                <div key={`${m.role}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                                      m.role === "user"
                                        ? "bg-amber-400 text-stone-900"
                                        : "bg-white border border-stone-200 text-stone-700"
                                    }`}
                                  >
                                    {m.text}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 border-t border-stone-100 flex gap-2 shrink-0">
                              <input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendChat(); } }}
                                placeholder={`Ask ${name} about memories…`}
                                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-300"
                              />
                              <button
                                type="button"
                                onClick={() => void sendChat()}
                                disabled={chatBusy || !chatInput.trim()}
                                className="rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-stone-200 disabled:text-stone-400 px-3 py-2 text-sm font-semibold text-stone-900 transition-colors"
                              >
                                {chatBusy ? "…" : "Send"}
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* ── Memories ──────────────────────────────────────────── */}
                  {tab === "memories" && (
                    <div className="h-full overflow-y-auto overscroll-contain p-5">
                      {liveMemories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2">
                          <p className="text-stone-400 text-sm">No memories yet.</p>
                          <p className="text-stone-300 text-xs text-center">
                            Memories are added from the Storyboard or when you evolve a character.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {liveMemories.map((m) => (
                            <li key={m.id} className="flex items-start gap-2.5 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-2.5">
                              <span className="mt-0.5 text-amber-400 text-sm">·</span>
                              <div>
                                <p className="text-sm text-stone-700">{m.text}</p>
                                {m.createdAt && (
                                  <p className="text-[11px] text-stone-400 mt-0.5">
                                    {new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* ── Evolution ─────────────────────────────────────────── */}
                  {tab === "evolution" && (
                    <div className="h-full overflow-hidden">
                      <EvolutionTimeline
                        characterName={name}
                        currentImageUrl={liveImageUrl}
                        versionHistory={liveHistory}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function ModalHeader({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 shrink-0">
      <div>
        <h2 className="font-serif text-lg font-bold text-stone-900">{title}</h2>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={onBack} className="text-sm font-medium text-stone-400 hover:text-stone-700 transition">
        ← Back
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-amber-400 text-stone-900"
          : "border-transparent text-stone-400 hover:text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ n, amber }: { n: number; amber?: boolean }) {
  return (
    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
      amber ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
    }`}>{n}</span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5 gap-4">
      <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold shrink-0 mt-0.5">{label}</p>
      <p className="text-sm text-stone-700 text-right">{children}</p>
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />;
}