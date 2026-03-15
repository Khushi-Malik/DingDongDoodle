"use client";

import { motion } from "motion/react";
import { AnimatedRigSprite, RigAnimMode } from "./AnimatedRigSprite";

interface CharacterProps {
  id: string;
  imageUrl: string;
  rigPath?: string | null;
  joints?: Partial<Record<"head_top" | "neck" | "shl" | "shr" | "hipl" | "hipr" | "footl" | "footr", { x: number; y: number }>> | null;
  riggedAt?: string | Date | null;
  name: string;
  age: number;
  position: { x: number; y: number };
  animationMode?: RigAnimMode;
  direction?: 1 | -1;
  onClick: () => void;
}

export function Character({
  imageUrl,
  rigPath,
  joints,
  riggedAt,
  name,
  position,
  animationMode = "idle",
  direction = 1,
  onClick,
}: CharacterProps) {
  return (
    <motion.div
      className="absolute cursor-pointer pointer-events-auto"
      data-no-pan="true"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
      initial={{ scale: 0, y: -100 }}
      animate={{ scale: 1, y: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      onClick={onClick}
    >
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 overflow-hidden relative">
          <AnimatedRigSprite
            imageUrl={imageUrl}
            rigPath={rigPath}
            joints={joints}
            riggedAt={riggedAt}
            name={name}
            mode={animationMode}
            direction={direction}
            frameSizePx={92}
          />
        </div>
        <div className="mt-2 px-3 py-1 rounded-full">
          <p className="text-sm font-medium text-gray-800">{name}</p>
        </div>
      </div>
    </motion.div>
  );
}
