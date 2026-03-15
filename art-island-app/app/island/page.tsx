"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, LogOut, MapPin, Moon, Sun, BookOpen, Bone } from "lucide-react";
import { PersonalityData } from "@/types/character";
import { Character } from "../components/Character";
import { CharacterDetail } from "../components/CharacterDetail";
import { UploadModal } from "../components/UploadModal";
import { NewIslandModal } from "../components/NewIslandModal";
import { ChooseInputModal } from "../components/ChooseInputModal";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { TutorialOverlay } from "../components/TutorialOverlay";
import { Minimap } from "../components/Minimap";
import JointEditor from "@/app/components/JointEditor";

type ModalState = "none" | "choose" | "draw" | "upload" | "rig";
type TutorialStep = "create-island" | "draw-maple" | "none";

interface CharacterData {
  id: string;
  imageUrl: string;
  name: string;
  age: number;
  position: { x: number; y: number };
  islandId: number;
}

interface IslandData {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  border: string;
  label: string;
  skin?: string;
}

interface IslandSkin {
  id: string;
  imagePath: string;
}

const ISLAND_SKINS: IslandSkin[] = [
  { id: "dirt", imagePath: "/island.png" },
  { id: "sand", imagePath: "/sand_island.png" },
  { id: "stone", imagePath: "/stone_island.png" },
];

const getIslandSkinImagePath = (skinId?: string): string => {
  const skin = ISLAND_SKINS.find((s) => s.id === skinId);
  return skin?.imagePath || ISLAND_SKINS[0].imagePath;
};

const ISLAND_SIZE = 620;
const CHARACTER_FOOTPRINT_PX = 112;

export default function App() {
  const router = useRouter();
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterData | null>(null);
  const [modalState, setModalState] = useState<ModalState>("none");
  const [pendingDrawing, setPendingDrawing] = useState<string | null>(null);
  const [showNewIslandModal, setShowNewIslandModal] = useState(false);
  const [islands, setIslands] = useState<IslandData[]>([]);
  const [nextIslandId, setNextIslandId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>("none");
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(true);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pendingCharacter, setPendingCharacter] = useState<{
    imageFile: File | null;
    name: string;
    age: number;
    islandId: number;
    personality: PersonalityData;
  } | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const res = await fetch("/api/characters");
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error("Failed to fetch");
        setCharacters(await res.json());
      } catch (error) {
        console.error("Error loading characters:", error);
      } finally {
        setLoading(false);
      }
    };

    const loadIslands = async () => {
      try {
        const res = await fetch("/api/islands");
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        const normalizedIslands = data.map((island: IslandData) => ({
          ...island,
          size: ISLAND_SIZE,
        }));
        setIslands(normalizedIslands);
        setNextIslandId(
          normalizedIslands.length > 0
            ? Math.max(...normalizedIslands.map((i: IslandData) => i.id)) + 1
            : 1,
        );
        if (normalizedIslands.length === 0) {
          setTutorialStep("create-island");
          setShowTutorialOverlay(true);
        }
      } catch (error) {
        console.error("Error loading islands:", error);
      }
    };

    loadCharacters();
    loadIslands();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleDeleteIsland = async (islandId: number) => {
    if (!window.confirm("Delete this island? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/islands?id=${islandId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete island");
      setIslands((prev) => prev.filter((i) => i.id !== islandId));
    } catch (error) {
      console.error("Error deleting island:", error);
      alert("Failed to delete island. Please try again.");
    }
  };

  const getValidIslandPosition = (): { x: number; y: number } => ({
    x: Math.random() * 70 + 10,
    y: Math.random() * 70 + 15,
  });

  const handleAddIsland = async (name: string, skin?: string) => {
    try {
      const newIsland: IslandData = {
        id: nextIslandId,
        ...getValidIslandPosition(),
        size: ISLAND_SIZE,
        color: "",
        border: "",
        label: name,
        skin: skin ?? "",
      };
      const res = await fetch("/api/islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIsland),
      });
      if (!res.ok) throw new Error("Failed to save island");
      const savedIsland = await res.json();
      setIslands((prev) => [...prev, savedIsland]);
      setNextIslandId((prev) => prev + 1);
      setShowNewIslandModal(false);
      if (tutorialStep === "create-island") {
        setTutorialStep("draw-maple");
        setShowTutorialOverlay(true);
      }
    } catch (error) {
      console.error("Error adding island:", error);
      alert("Failed to add island. Please try again.");
    }
  };

  const getCharacterPosition = (islandId: number): { x: number; y: number } => {
    const island = islands.find((i) => i.id === islandId);
    if (!island) return { x: 50, y: 50 };
    const existingPositions = characters
      .filter((char) => char.islandId === islandId)
      .map((char) => char.position);
    const minDistance = (CHARACTER_FOOTPRINT_PX / island.size) * 100;
    const maxRadius = 50 - minDistance / 2 - 3;
    if (existingPositions.length === 0) return { x: 50, y: 50 };
    for (let attempt = 0; attempt < 240; attempt++) {
      const angle = attempt * 2.399963229728653;
      const distance = maxRadius * (0.45 + 0.55 * ((attempt % 12) / 11));
      const candidate = {
        x: 50 + Math.cos(angle) * distance,
        y: 50 + Math.sin(angle) * distance,
      };
      const isColliding = existingPositions.some((position) => {
        const dx = position.x - candidate.x;
        const dy = position.y - candidate.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });
      if (!isColliding) return candidate;
    }
    return { x: 50, y: 50 };
  };

  const getIslandCharacterLayouts = (
    islandId: number,
    islandList: IslandData[],
    characterList: CharacterData[],
  ) => {
    const island = islandList.find((item) => item.id === islandId);
    if (!island) return [] as CharacterData[];
    const islandCharacters = characterList.filter(
      (char) => char.islandId === islandId,
    );
    const placedPositions: Array<{ x: number; y: number }> = [];
    const minDistance = (CHARACTER_FOOTPRINT_PX / island.size) * 100;
    const greenTopStart = 10;
    const greenTopEnd = 45;
    const greenLeft = 15;
    const greenRight = 85;
    const greenWidth = greenRight - greenLeft;
    const greenHeight = greenTopEnd - greenTopStart;

    return islandCharacters.map((character, index) => {
      const cols = Math.ceil(Math.sqrt(islandCharacters.length));
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = greenLeft + (greenWidth * (col + 0.5)) / cols;
      const y = greenTopStart + (greenHeight * (row + 0.5)) / cols;
      const candidate = { x, y };
      const isColliding = placedPositions.some((position) => {
        const dx = position.x - candidate.x;
        const dy = position.y - candidate.y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });
      if (!isColliding) {
        placedPositions.push(candidate);
        return { ...character, position: candidate };
      }
      const fallback = {
        x: Math.max(greenLeft, Math.min(greenRight, candidate.x + ((index % 3) - 1) * 8)),
        y: Math.max(greenTopStart, Math.min(greenTopEnd, candidate.y + ((index % 2) - 0.5) * 6)),
      };
      placedPositions.push(fallback);
      return { ...character, position: fallback };
    });
  };

  const islandCharacterLayouts = useMemo(() => {
    const layouts: Record<number, CharacterData[]> = {};
    islands.forEach((island) => {
      layouts[island.id] = getIslandCharacterLayouts(island.id, islands, characters);
    });
    return layouts;
  }, [islands, characters]);

  const getIslandDisplayPosition = (index: number, total: number) => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const column = index % columns;
    const row = Math.floor(index / columns);
    const horizontalSpacing = ISLAND_SIZE + 180;
    const verticalSpacing = ISLAND_SIZE + 220;
    const offsetX = (column - (columns - 1) / 2) * horizontalSpacing;
    const offsetY = (row - (Math.ceil(total / columns) - 1) / 2) * verticalSpacing;
    return {
      left: `calc(50% + ${offsetX}px)`,
      top: `calc(50% + ${offsetY}px)`,
    };
  };

  const handleDrawingSave = (dataUrl: string) => {
    setPendingDrawing(dataUrl);
    setModalState("upload");
  };

  const handleAddCharacter = async (
    imageFile: File | null,
    name: string,
    age: number,
    islandId: number,
    personality: PersonalityData,
  ) => {
    setPendingCharacter({ imageFile, name, age, islandId, personality });
    setModalState("rig");
  };

  const handleRigConfirm = async (
    joints: Record<string, { x: number; y: number }>,
  ) => {
    if (!pendingCharacter) return;
    const { imageFile, name, age, islandId, personality } = pendingCharacter;
    try {
      const position = getCharacterPosition(islandId);
      let imageUrl = pendingDrawing;
      if (!imageUrl && imageFile) {
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age, imageUrl, position, islandId, joints, personality }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const newCharacter = await res.json();
      setCharacters((prev) => [...prev, newCharacter]);
      setPendingDrawing(null);
      setPendingCharacter(null);
      setModalState("none");
    } catch (error) {
      console.error("Error adding character:", error);
      alert("Failed to add character. Please try again.");
    }
  };

  const handleTutorialDismiss = () => {
    if (tutorialStep === "create-island") {
      setShowTutorialOverlay(false);
      setShowNewIslandModal(true);
    } else if (tutorialStep === "draw-maple") {
      setModalState("choose");
      setShowTutorialOverlay(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const newZoom = Math.min(Math.max(zoom - e.deltaY * 0.001, 0.3), 3);
    const zoomRatio = newZoom / zoom;
    const mouseX = e.clientX - window.innerWidth / 2;
    const mouseY = e.clientY - window.innerHeight / 2;
    setPanX((prev) => mouseX + (prev - mouseX) * zoomRatio);
    setPanY((prev) => mouseY + (prev - mouseY) * zoomRatio);
    setZoom(newZoom);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (modalState === "draw" || modalState === "upload" || modalState === "rig" || selectedCharacter) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-pan='true']") || target.closest("button") || target.closest("a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const deltaX = e.clientX - panStartRef.current.x;
    const deltaY = e.clientY - panStartRef.current.y;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) <= 3) return;
    setPanX((c) => c + deltaX);
    setPanY((c) => c + deltaY);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const stopPanning = () => { panStartRef.current = null; setIsPanning(false); };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    stopPanning();
  };

  const handleCanvasPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    stopPanning();
  };

  // ── colours ────────────────────────────────────────────────────────────────
  const bg = darkMode ? "#0f2336" : "#e8f9ff";
  const navBg = darkMode ? "rgba(15,35,54,0.85)" : "rgba(255,255,255,0.85)";
  const navBorder = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const textPrimary = darkMode ? "#f0f6ff" : "#1a1a1a";
  const textMuted = darkMode ? "#7ea8c4" : "#888780";
  const btnBg = darkMode ? "#1e3a52" : "#000000";
  const btnText = "#ffffff";
  const btnHoverBg = darkMode ? "#2a4d6b" : "#222222";

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center" style={{ backgroundColor: bg }}>
        <p className="text-lg animate-pulse" style={{ color: textMuted }}>
          Loading islands…
        </p>
      </div>
    );
  }

  return (
    <div
      className={`size-full touch-none select-none relative overflow-hidden ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ backgroundColor: bg }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerCancel}
      onWheel={handleWheel}
    >
      {/* ── Island canvas ──────────────────────────────────────────────────── */}
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transition: isPanning ? "none" : "transform 0.1s ease-out",
        }}
        className="absolute inset-0 pointer-events-none"
      >
        {islands.map((planet, index) => {
          const displayPosition = getIslandDisplayPosition(index, islands.length);
          const imagePath = getIslandSkinImagePath(planet.skin);
          return (
            <div
              key={planet.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
              style={displayPosition}
            >
              <div
                style={{
                  width: planet.size,
                  height: planet.size * 0.4,
                  overflow: "hidden",
                  position: "relative",
                  backgroundImage: `url('${imagePath}')`,
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center top",
                }}
              >
                {(islandCharacterLayouts[planet.id] ?? []).map((character) => (
                  <Character
                    key={character.id}
                    {...character}
                    onClick={() => setSelectedCharacter(character)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <p className="text-lg font-medium" style={{ color: textMuted }}>
                  {planet.label}
                </p>
                <button
                  onClick={() => handleDeleteIsland(planet.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow"
                  title="Delete island"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {islands.length === 0 && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none px-6 text-center">
          <p className="text-4xl">🏝️</p>
          <div>
            <p className="text-lg font-semibold" style={{ color: textPrimary }}>
              No islands yet
            </p>
            <p className="text-sm mt-1" style={{ color: textMuted }}>
              Create your first island, then add your drawings to bring it to life.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewIslandModal(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{ backgroundColor: btnBg, color: btnText }}
          >
            <MapPin className="w-4 h-4" />
            Create first island
          </button>
        </div>
      )}

      {/* ── Top navbar ─────────────────────────────────────────────────────── */}
      {/* Title */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{
          background: navBg,
          borderBottom: `1px solid ${navBorder}`,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Brand */}
        <div>
          <h1 className="text-base sm:text-lg font-semibold leading-tight" style={{ color: textPrimary }}>
            Ding Dong Doodle
          </h1>
          <p className="text-[11px] hidden sm:block" style={{ color: textMuted }}>
            Draw · Dream · Discover
          </p>
        </div>

        {/* Centre action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Add Drawing */}
          <NavBtn
            icon={<Plus className="w-4 h-4" />}
            label="Add Drawing"
            shortLabel="Add"
            onClick={() => setModalState("choose")}
            bg={btnBg}
            hoverBg={btnHoverBg}
            color={btnText}
          />

          {/* New Island */}
          <NavBtn
            icon={<MapPin className="w-4 h-4" />}
            label="New Island"
            shortLabel="Island"
            onClick={() => setShowNewIslandModal(true)}
            bg={btnBg}
            hoverBg={btnHoverBg}
            color={btnText}
          />

          {/* Rig */}
          <NavBtn
            icon={<Bone className="w-4 h-4" />}
            label="Rig Character"
            shortLabel="Rig"
            onClick={() => router.push("/rig")}
            bg={btnBg}
            hoverBg={btnHoverBg}
            color={btnText}
          />

          {/* Storyboard — amber so it stands out */}
          <NavBtn
            icon={<BookOpen className="w-4 h-4" />}
            label="Storyboard"
            shortLabel="Stories"
            onClick={() => router.push("/storyboard")}
            bg={darkMode ? "#92400e" : "#f59e0b"}
            hoverBg={darkMode ? "#b45309" : "#d97706"}
            color={darkMode ? "#fff" : "#1c1917"}
          />
        </div>

        {/* Right: dark mode + logout */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDarkMode((p) => !p)}
            title="Toggle theme"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ backgroundColor: btnBg, color: btnText }}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ backgroundColor: btnBg, color: btnText }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCharacter && (
          <CharacterDetail
            {...selectedCharacter}
            onClose={() => setSelectedCharacter(null)}
          />
        )}

        {modalState === "choose" && (
          <ChooseInputModal
            onChooseDraw={() => setModalState("draw")}
            onChooseUpload={() => setModalState("upload")}
            onClose={() => { setModalState("none"); setPendingDrawing(null); }}
          />
        )}

        {modalState === "draw" && (
          <motion.div
            key="draw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          >
            <DrawingCanvas
              onSave={handleDrawingSave}
              onClose={() => setModalState("choose")}
              tutorialHint={
                tutorialStep === "draw-maple"
                  ? "🦆 Draw a character! Let your creativity shine!"
                  : undefined
              }
            />
          </motion.div>
        )}

        {modalState === "upload" && (
          <UploadModal
            onClose={() => { setPendingDrawing(null); setModalState("choose"); }}
            onSubmit={handleAddCharacter}
            previewImageUrl={pendingDrawing ?? undefined}
            islands={islands}
          />
        )}

        {modalState === "rig" && pendingCharacter && (
          <motion.div
            key="rig"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-gray-800">Place joints</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Click to place each joint on{" "}
                    <span className="font-medium text-gray-600">{pendingCharacter.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setPendingCharacter(null); setModalState("upload"); }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back
                </button>
              </div>
              <div className="p-4">
                <JointEditor
                  imageUrl={pendingDrawing ?? ""}
                  onConfirm={handleRigConfirm}
                  onBack={() => { setPendingCharacter(null); setModalState("upload"); }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {showNewIslandModal && (
          <NewIslandModal
            onClose={() => setShowNewIslandModal(false)}
            onSubmit={handleAddIsland}
            isTutorial={tutorialStep === "create-island"}
            defaultSkinIndex={islands.length}
          />
        )}
      </AnimatePresence>

      {/* Tutorial */}
      {showTutorialOverlay &&
        (tutorialStep === "create-island" || tutorialStep === "draw-maple") && (
          <TutorialOverlay step={tutorialStep} onDismiss={handleTutorialDismiss} />
        )}

      {/* Minimap */}
      {islands.length > 0 && (
        <Minimap
          islands={islands}
          characters={characters}
          panX={panX}
          panY={panY}
          zoom={zoom}
        />
      )}
    </div>
  );
}

// ─── Reusable nav button ──────────────────────────────────────────────────────

function NavBtn({
  icon,
  label,
  shortLabel,
  onClick,
  bg,
  hoverBg,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  shortLabel: string;
  onClick: () => void;
  bg: string;
  hoverBg: string;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors"
      style={{ backgroundColor: hovered ? hoverBg : bg, color }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel}</span>
    </button>
  );
}