"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface IslandData {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  border: string;
  label: string;
}

interface CharacterData {
  id: string;
  position: { x: number; y: number };
  islandId?: number;
}

interface MinimapProps {
  islands: IslandData[];
  characters: CharacterData[];
  panX: number;
  panY: number;
}

const ISLAND_SIZE = 620;

export function Minimap({ islands, characters, panX, panY }: MinimapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const minimapWidth = 200;
  const minimapHeight = 120;
  const expandedWidth = 900;
  const expandedHeight = 650;

  // Calculate actual pixel positions for all islands using the grid layout
  const getIslandPixelPosition = (index: number, total: number) => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const rows = Math.ceil(total / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const horizontalSpacing = ISLAND_SIZE + 180; // 800px
    const verticalSpacing = ISLAND_SIZE + 220; // 840px
    const offsetX = (column - (columns - 1) / 2) * horizontalSpacing;
    const offsetY = (row - (rows - 1) / 2) * verticalSpacing;
    return { x: offsetX, y: offsetY };
  };

  // Get all island positions in world space
  const islandPixelPositions = islands.map((island, index) =>
    getIslandPixelPosition(index, islands.length),
  );

  // Calculate world bounds (expand by island radius to account for island size)
  const islandRadius = ISLAND_SIZE / 2;
  const allX = islandPixelPositions.map((p) => p.x);
  const allY = islandPixelPositions.map((p) => p.y);

  const minX = Math.min(...allX, -window.innerWidth / 2) - islandRadius;
  const maxX = Math.max(...allX, window.innerWidth / 2) + islandRadius;
  const minY = Math.min(...allY, -window.innerHeight / 2) - islandRadius;
  const maxY = Math.max(...allY, window.innerHeight / 2) + islandRadius;

  const worldWidth = maxX - minX || window.innerWidth;
  const worldHeight = maxY - minY || window.innerHeight;

  const scaleX = minimapWidth / worldWidth;
  const scaleY = minimapHeight / worldHeight;

  // Convert world position to user-centric minimap coordinates (user always in center)
  const worldToUserCentricMinimap = (worldX: number, worldY: number) => ({
    x: (worldX + panX) * scaleX + minimapWidth / 2,
    y: (worldY + panY) * scaleY + minimapHeight / 2,
  });

  return (
    <>
      {/* Minimap */}
      <div
        className="fixed bottom-4 right-4"
        style={{ cursor: "pointer", zIndex: 50, pointerEvents: "auto" }}
        onClick={(e) => {
          console.log("Minimap clicked");
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(true);
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2">
          <div
            className="relative overflow-hidden border border-gray-300 bg-gray-50"
            style={{
              width: minimapWidth,
              height: minimapHeight,
              pointerEvents: "none",
            }}
          >
            {/* Islands */}
            {islands.map((island, index) => {
              const pixelPos = islandPixelPositions[index];
              const minimapPos = worldToUserCentricMinimap(
                pixelPos.x,
                pixelPos.y,
              );
              const displaySize =
                (island.size / worldWidth) * minimapWidth * 0.3;

              return (
                <div
                  key={island.id}
                  className="absolute rounded-full"
                  style={{
                    left: minimapPos.x - displaySize / 2,
                    top: minimapPos.y - displaySize / 2,
                    width: displaySize,
                    height: displaySize,
                    backgroundColor: island.color,
                    border: `1.5px solid ${island.border}`,
                    opacity: 0.8,
                    pointerEvents: "none",
                  }}
                  title={island.label}
                />
              );
            })}

            {/* Characters */}
            {characters.map((character) => {
              // Characters are positioned relative to islands
              // For simplicity, show them near their island positions
              const island = islands.find((i) => i.id === character.islandId);
              if (!island) return null;

              const islandIndex = islands.indexOf(island);
              const islandPixelPos = islandPixelPositions[islandIndex];

              // Characters are offset from island center
              const charWorldX = islandPixelPos.x + character.position.x - 50;
              const charWorldY = islandPixelPos.y + character.position.y - 50;

              const charMinimapPos = worldToUserCentricMinimap(
                charWorldX,
                charWorldY,
              );

              return (
                <div
                  key={character.id}
                  className="absolute rounded-full"
                  style={{
                    left: charMinimapPos.x - 3,
                    top: charMinimapPos.y - 3,
                    width: 6,
                    height: 6,
                    backgroundColor: "#7F77DD",
                    border: "1px solid #6366f1",
                    pointerEvents: "none",
                  }}
                  title={character.name}
                />
              );
            })}

            {/* Viewport indicator - user always in center */}
            <div
              className="absolute rounded-full"
              style={{
                left: minimapWidth / 2 - 4,
                top: minimapHeight / 2 - 4,
                width: 8,
                height: 8,
                backgroundColor: "#000000",
                border: "1px solid #7C3AED",
                pointerEvents: "none",
                opacity: 0.8,
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center pointer-events-none">
            Minimap (Click to expand)
          </p>
        </div>
      </div>

      {/* Expanded Map Popup */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ pointerEvents: "auto" }}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-2xl p-3 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: expandedWidth, height: expandedHeight }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsExpanded(false)}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded z-10"
            >
              <X size={20} />
            </button>

            <div
              className="relative overflow-hidden border border-gray-300 bg-gray-50"
              style={{ width: expandedWidth - 24, height: expandedHeight - 40 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Islands */}
              {islands.map((island, index) => {
                const pixelPos = islandPixelPositions[index];
                const expandedScaleX = (expandedWidth - 24) / worldWidth;
                const expandedScaleY = (expandedHeight - 40) / worldHeight;

                const expandedPos = {
                  x:
                    (pixelPos.x + panX) * expandedScaleX +
                    (expandedWidth - 24) / 2,
                  y:
                    (pixelPos.y + panY) * expandedScaleY +
                    (expandedHeight - 40) / 2,
                };
                const displaySize =
                  (island.size / worldWidth) * (expandedWidth - 24) * 0.3;

                return (
                  <div
                    key={island.id}
                    className="absolute rounded-full"
                    style={{
                      left: expandedPos.x - displaySize / 2,
                      top: expandedPos.y - displaySize / 2,
                      width: displaySize,
                      height: displaySize,
                      backgroundColor: island.color,
                      border: `2px solid ${island.border}`,
                      opacity: 0.8,
                      pointerEvents: "none",
                    }}
                    title={island.label}
                  />
                );
              })}

              {/* Characters */}
              {characters.map((character) => {
                const island = islands.find((i) => i.id === character.islandId);
                if (!island) return null;

                const islandIndex = islands.indexOf(island);
                const islandPixelPos = islandPixelPositions[islandIndex];
                const expandedScaleX = (expandedWidth - 24) / worldWidth;
                const expandedScaleY = (expandedHeight - 40) / worldHeight;

                const charWorldX = islandPixelPos.x + character.position.x - 50;
                const charWorldY = islandPixelPos.y + character.position.y - 50;

                const expandedPos = {
                  x:
                    (charWorldX + panX) * expandedScaleX +
                    (expandedWidth - 24) / 2,
                  y:
                    (charWorldY + panY) * expandedScaleY +
                    (expandedHeight - 40) / 2,
                };

                return (
                  <div
                    key={character.id}
                    className="absolute rounded-full"
                    style={{
                      left: expandedPos.x - 5,
                      top: expandedPos.y - 5,
                      width: 10,
                      height: 10,
                      backgroundColor: "#7F77DD",
                      border: "2px solid #6366f1",
                      pointerEvents: "none",
                    }}
                    title={character.name}
                  />
                );
              })}

              {/* User indicator */}
              <div
                className="absolute rounded-full"
                style={{
                  left: (expandedWidth - 24) / 2 - 5,
                  top: (expandedHeight - 40) / 2 - 5,
                  width: 10,
                  height: 10,
                  backgroundColor: "#000000",
                  border: "2px solid #7C3AED",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
