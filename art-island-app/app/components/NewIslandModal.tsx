"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";

interface IslandSkin {
  id: string;
  imagePath: string;
  label: string;
}

const ISLAND_SKINS: IslandSkin[] = [
  { id: "dirt", imagePath: "/island.png", label: "Dirt" },
  { id: "sand", imagePath: "/sand_island.png", label: "Sand" },
  { id: "stone", imagePath: "/stone_island.png", label: "Stone" },
];

interface NewIslandModalProps {
  onClose: () => void;
  onSubmit: (name: string, skinId: string) => void;
  isTutorial?: boolean;
  defaultSkinIndex?: number;
}

export function NewIslandModal({
  onClose,
  onSubmit,
  isTutorial,
  defaultSkinIndex = 0,
}: NewIslandModalProps) {
  const [name, setName] = useState(isTutorial ? "Toronto" : "");
  const [selectedSkin, setSelectedSkin] = useState(
    ISLAND_SKINS[defaultSkinIndex % ISLAND_SKINS.length],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, selectedSkin.id);
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        transition={{ type: "spring", damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Create New Island
        </h2>
        {isTutorial && (
          <p className="text-sm text-gray-600 mb-6">
            🍁 Perfect! Let's create your first island - Toronto!
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="island-name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Island Name
            </label>
            <input
              type="text"
              id="island-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
              placeholder="Enter island name..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Skin
            </label>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {ISLAND_SKINS.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => setSelectedSkin(skin)}
                  className={`p-2 rounded-lg transition-all border-2 ${
                    selectedSkin.id === skin.id
                      ? "border-green-500 ring-2 ring-green-300"
                      : "border-gray-300 hover:border-green-300"
                  }`}
                  title={skin.label}
                >
                  <img
                    src={skin.imagePath}
                    alt={skin.label}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="text-xs font-medium text-gray-700 mt-1">
                    {skin.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Create Island
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
