"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { X, Upload } from "lucide-react";
import { PersonalityData } from "@/types/character";

interface EvolveCharacterModalProps {
  characterName: string;
  currentImageUrl: string;
  onClose: () => void;
  onSubmit: (
    imageFile: File,
    personalityDelta: PersonalityData,
    memoryText: string,
  ) => void;
}

export function EvolveCharacterModal({
  characterName,
  currentImageUrl,
  onClose,
  onSubmit,
}: EvolveCharacterModalProps) {
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [memoryText, setMemoryText] = useState("");
  const [personalityDelta, setPersonalityDelta] = useState<PersonalityData>({
    catchphrase: "",
    traits: [],
    dailyActivity: "",
    favoriteThing: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;
    onSubmit(imageFile, personalityDelta, memoryText);
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
        className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.92, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-gray-800">Evolve {characterName}</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Upload a grown version, then place joints again.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Current</p>
              <div className="h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Evolved</p>
              <label className="h-28 rounded-lg overflow-hidden border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-gray-400">
                {previewUrl !== currentImageUrl ? (
                  <img src={previewUrl} alt="Evolved preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-500 text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  required
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add memory (optional)</label>
            <textarea
              value={memoryText}
              onChange={(e) => setMemoryText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="What changed in this stage?"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              value={personalityDelta.catchphrase}
              onChange={(e) =>
                setPersonalityDelta((prev) => ({ ...prev, catchphrase: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="New catchphrase (optional)"
            />
            <input
              type="text"
              value={personalityDelta.dailyActivity}
              onChange={(e) =>
                setPersonalityDelta((prev) => ({ ...prev, dailyActivity: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="New daily activity (optional)"
            />
            <input
              type="text"
              value={personalityDelta.favoriteThing}
              onChange={(e) =>
                setPersonalityDelta((prev) => ({ ...prev, favoriteThing: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="New favorite thing (optional)"
            />
            <input
              type="text"
              value={personalityDelta.traits.join(", ")}
              onChange={(e) =>
                setPersonalityDelta((prev) => ({
                  ...prev,
                  traits: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Extra traits, comma separated (optional)"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!imageFile}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2 rounded-lg"
            >
              Continue To Rig
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
