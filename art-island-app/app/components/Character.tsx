"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

interface RigPart {
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivot_x: number;
  pivot_y: number;
  z: number;
}

interface RigData {
  character: {
    width: number;
    height: number;
  };
  parts: Record<string, RigPart>;
}

interface CharacterProps {
  id: string;
  imageUrl: string;
  rigPath?: string | null;
  name: string;
  age: number;
  position: { x: number; y: number };
  moving?: boolean;
  direction?: 1 | -1;
  onClick: () => void;
}

function resolvePartPath(rigPath: string, file: string) {
  if (/^https?:\/\//i.test(file) || file.startsWith("/")) return file;
  const slash = rigPath.lastIndexOf("/");
  const base = slash >= 0 ? rigPath.slice(0, slash + 1) : "";
  return `${base}${file}`;
}

function partPose(part: string, t: number, moving: boolean) {
  if (!moving) {
    const bob = Math.sin(t * 2.2) * 1.5;
    const sway = Math.sin(t * 1.3) * 2;
    if (part === "head") return { rotate: sway * 0.6, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: sway * 0.35, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: -8 + Math.sin(t * 1.8) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: 8 + Math.sin(t * 1.8 + Math.PI) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
    return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
  }

  const phase = t * Math.PI * 2 * 1.6;
  const swing = 26;
  const bob = Math.abs(Math.sin(phase)) * -3.5;

  if (part === "head") return { rotate: Math.sin(phase) * 1.6, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "torso") return { rotate: Math.sin(phase) * 2.6, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "arm_left") return { rotate: Math.sin(phase) * swing * 0.65, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "arm_right") return { rotate: Math.sin(phase + Math.PI) * swing * 0.65, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "leg_left") return { rotate: Math.sin(phase) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "leg_right") return { rotate: Math.sin(phase + Math.PI) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
  return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
}

export function Character({
  imageUrl,
  rigPath,
  name,
  position,
  moving = false,
  direction = 1,
  onClick,
}: CharacterProps) {
  const [rig, setRig] = useState<RigData | null>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!rigPath) {
      setRig(null);
      return;
    }
    let cancelled = false;
    fetch(rigPath)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RigData | null) => {
        if (!cancelled) setRig(data);
      })
      .catch(() => {
        if (!cancelled) setRig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rigPath]);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const orderedParts = useMemo(() => {
    if (!rig) return [] as Array<[string, RigPart]>;
    return Object.entries(rig.parts).sort((a, b) => a[1].z - b[1].z);
  }, [rig]);

  const spriteStyle = moving
    ? { transform: `translateY(${Math.abs(Math.sin(t * Math.PI * 2 * 1.6)) * -2}px) scaleX(${direction})` }
    : { transform: `translateY(${Math.sin(t * 2.2) * 1.5}px) scaleX(${direction})` };

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
          {rig ? (
            <div className="absolute inset-0">
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  width: rig.character.width,
                  height: rig.character.height,
                  transform: `translateX(-50%) scale(${Math.min(92 / rig.character.width, 92 / rig.character.height)}) scaleX(${direction})`,
                  transformOrigin: "50% 100%",
                }}
              >
                {orderedParts.map(([partName, part]) => {
                  const pose = partPose(partName, t, moving);
                  return (
                    <div
                      key={partName}
                      style={{
                        position: "absolute",
                        left: part.x,
                        top: part.y,
                        width: part.width,
                        height: part.height,
                        zIndex: part.z,
                        transformOrigin: `${part.pivot_x}px ${part.pivot_y}px`,
                        transform: `translate(${pose.tx}px, ${pose.ty}px) rotate(${pose.rotate}deg) scale(${pose.sx}, ${pose.sy})`,
                      }}
                    >
                      <img
                        src={resolvePartPath(rigPath as string, part.file)}
                        alt={`${name}-${partName}`}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
              style={spriteStyle}
              draggable={false}
            />
          )}
        </div>
        <div className="mt-2 px-3 py-1 rounded-full">
          <p className="text-sm font-medium text-gray-800">{name}</p>
        </div>
      </div>
    </motion.div>
  );
}
