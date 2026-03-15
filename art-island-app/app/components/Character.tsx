"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { RigAnimMode } from "./AnimatedRigSprite";

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
  name,
  position,
  animationMode = "idle",
  direction = 1,
  onClick,
}: CharacterProps) {
  const visualTop = Math.max(0, position.y - 12);

  const anim = (() => {
    switch (animationMode) {
      case "walk":
        return {
          animate: { y: [0, -3, 0] },
          transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
        };
      case "hop":
        return {
          animate: { y: [0, -10, 0] },
          transition: { duration: 0.55, repeat: Infinity, ease: "easeInOut" },
        };
      case "wave":
        return {
          animate: { y: [0, -2, 0], rotate: [0, 2, 0, -2, 0] },
          transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
        };
      case "run":
        return {
          animate: { y: [0, -5, 0] },
          transition: { duration: 0.34, repeat: Infinity, ease: "linear" },
        };
      case "dance":
        return {
          animate: { y: [0, -4, 0], rotate: [0, 5, 0, -5, 0] },
          transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
        };
      case "sleep":
        return {
          animate: { y: [0, -1, 0], rotate: [0, 1, 0] },
          transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
        };
      case "idle":
      default:
        return {
          animate: { y: [0, -2, 0] },
          transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
        };
    }
  })();

  return (
    <motion.div
      className="absolute cursor-pointer pointer-events-auto"
      data-no-pan="true"
      style={{
        left: `${position.x}%`,
        top: `${visualTop}%`,
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
        <motion.div
          className="w-24 h-24 overflow-hidden relative"
          animate={anim.animate}
          transition={anim.transition}
        >
          <Image
            src={imageUrl}
            alt={name}
            fill
            unoptimized
            sizes="96px"
            className="object-cover"
            draggable={false}
            style={{ transform: `scaleX(${direction})` }}
          />
        </motion.div>
        <div className="mt-2 px-3 py-1 rounded-full">
          <p className="text-sm font-medium text-gray-800">{name}</p>
        </div>
      </div>
    </motion.div>
  );
}
