"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

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

type JointMap = Partial<Record<"head_top" | "neck" | "shl" | "shr" | "hipl" | "hipr" | "footl" | "footr", { x: number; y: number }>>;

export type RigAnimMode = "idle" | "walk" | "hop" | "wave" | "run" | "dance" | "sleep";

interface AnimatedRigSpriteProps {
  imageUrl: string;
  rigPath?: string | null;
  joints?: JointMap | null;
  riggedAt?: string | Date | null;
  allowJointFallback?: boolean;
  name: string;
  mode: RigAnimMode;
  direction?: 1 | -1;
  frameSizePx: number;
}

function resolvePartPath(rigPath: string | null | undefined, file: string) {
  if (
    /^https?:\/\//i.test(file) ||
    file.startsWith("/") ||
    file.startsWith("data:")
  ) {
    return file;
  }
  if (!rigPath) return file;
  const slash = rigPath.lastIndexOf("/");
  const base = slash >= 0 ? rigPath.slice(0, slash + 1) : "";
  return `${base}${file}`;
}

function partPose(part: string, t: number, mode: RigAnimMode) {
  if (mode === "wave") {
    const bob = Math.sin(t * 2) * 2;
    const wave = Math.sin(t * 6) * 35 - 55;
    if (part === "head") return { rotate: Math.sin(t * 2) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: Math.sin(t * 1.2) * 1.5, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: -10, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: wave, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: 4, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: -4, tx: 0, ty: bob, sx: 1, sy: 1 };
    return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
  }

  if (mode === "hop") {
    const phase = t * Math.PI * 2 * 2;
    const hopY = -Math.max(0, Math.sin(phase)) * 12;
    const swing = 18;
    if (part === "head") return { rotate: Math.sin(phase) * 2, tx: 0, ty: hopY, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: Math.sin(phase) * 3, tx: 0, ty: hopY, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: Math.sin(phase) * swing * 0.7, tx: 0, ty: hopY, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: Math.sin(phase + Math.PI) * swing * 0.7, tx: 0, ty: hopY, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: Math.sin(phase) * swing, tx: 0, ty: hopY, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: Math.sin(phase + Math.PI) * swing, tx: 0, ty: hopY, sx: 1, sy: 1 };
    return { rotate: 0, tx: 0, ty: hopY, sx: 1, sy: 1 };
  }

  if (mode === "walk") {
    const phase = t * Math.PI * 2 * 1.8;
    const bob = Math.abs(Math.sin(phase)) * -4;
    const swing = 28;
    if (part === "head") return { rotate: Math.sin(phase) * 2, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: Math.sin(phase) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: Math.sin(phase) * swing * 0.7, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: Math.sin(phase + Math.PI) * swing * 0.7, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: Math.sin(phase) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: Math.sin(phase + Math.PI) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
    return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
  }

  if (mode === "run") {
    const phase = t * Math.PI * 2 * 3.2;
    const bob = Math.abs(Math.sin(phase)) * -7;
    const swing = 45;
    if (part === "head") return { rotate: Math.sin(phase) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: Math.sin(phase) * 5, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: Math.sin(phase) * swing * 0.9, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: Math.sin(phase + Math.PI) * swing * 0.9, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: Math.sin(phase) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: Math.sin(phase + Math.PI) * swing, tx: 0, ty: bob, sx: 1, sy: 1 };
    return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
  }

  if (mode === "dance") {
    const phase = t * Math.PI * 2 * 2.4;
    const shimmyX = Math.sin(phase) * 3;
    const shimmyY = Math.sin(phase * 2) * 2;
    if (part === "head") return { rotate: Math.sin(phase) * 7, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: Math.sin(phase + Math.PI / 2) * 10, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: -40 + Math.sin(phase) * 35, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: 40 + Math.sin(phase + Math.PI) * 35, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: Math.sin(phase) * 18, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: Math.sin(phase + Math.PI) * 18, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
    return { rotate: 0, tx: shimmyX, ty: shimmyY, sx: 1, sy: 1 };
  }

  if (mode === "sleep") {
    const breathe = Math.sin(t * 1.4) * 0.8;
    const tilt = 10;
    if (part === "head") return { rotate: tilt + Math.sin(t * 1.4) * 1.2, tx: 0, ty: breathe, sx: 1, sy: 1 };
    if (part === "torso") return { rotate: tilt * 0.6, tx: 0, ty: breathe, sx: 1, sy: 1 };
    if (part === "arm_left") return { rotate: -20, tx: 0, ty: breathe, sx: 1, sy: 1 };
    if (part === "arm_right") return { rotate: 15, tx: 0, ty: breathe, sx: 1, sy: 1 };
    if (part === "leg_left") return { rotate: 8, tx: 0, ty: breathe, sx: 1, sy: 1 };
    if (part === "leg_right") return { rotate: -6, tx: 0, ty: breathe, sx: 1, sy: 1 };
    return { rotate: tilt * 0.4, tx: 0, ty: breathe, sx: 1, sy: 1 };
  }

  const bob = Math.sin(t * 2.2) * 1.5;
  const sway = Math.sin(t * 1.3) * 2;
  if (part === "head") return { rotate: sway * 0.6, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "torso") return { rotate: sway * 0.35, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "arm_left") return { rotate: -8 + Math.sin(t * 1.8) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
  if (part === "arm_right") return { rotate: 8 + Math.sin(t * 1.8 + Math.PI) * 3, tx: 0, ty: bob, sx: 1, sy: 1 };
  return { rotate: 0, tx: 0, ty: bob, sx: 1, sy: 1 };
}

export function AnimatedRigSprite({
  imageUrl,
  rigPath,
  joints,
  riggedAt,
  allowJointFallback = false,
  name,
  mode,
  direction = 1,
  frameSizePx,
}: AnimatedRigSpriteProps) {
  const [rig, setRig] = useState<RigData | null>(null);
  const [t, setT] = useState(0);

  const hasUsableJoints = !!(
    joints &&
    joints.neck &&
    joints.shl &&
    joints.shr &&
    joints.hipl &&
    joints.hipr &&
    joints.footl &&
    joints.footr
  );

  useEffect(() => {
    if (!rigPath) return;

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
    if (!allowJointFallback || rigPath || !hasUsableJoints) return;

    let cancelled = false;
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    img.onload = () => {
      if (cancelled || !joints) return;

      const w = img.naturalWidth || frameSizePx;
      const h = img.naturalHeight || frameSizePx;

      const p = (k: keyof JointMap, fb: { x: number; y: number }) => joints[k] ?? fb;
      const neck = p("neck", { x: w * 0.5, y: h * 0.28 });
      const shl = p("shl", { x: w * 0.35, y: h * 0.35 });
      const shr = p("shr", { x: w * 0.65, y: h * 0.35 });
      const hipl = p("hipl", { x: w * 0.42, y: h * 0.58 });
      const hipr = p("hipr", { x: w * 0.58, y: h * 0.58 });
      const footl = p("footl", { x: w * 0.43, y: h * 0.95 });
      const footr = p("footr", { x: w * 0.57, y: h * 0.95 });

      const yHeadTop = clamp((joints.head_top?.y ?? neck.y - h * 0.2) - 8, 0, h - 2);
      const yNeck = clamp(neck.y, 0, h - 2);
      const yHip = clamp((hipl.y + hipr.y) / 2, yNeck + 10, h - 2);
      const yFoot = clamp(Math.max(footl.y, footr.y), yHip + 12, h);

      const xTorsoL = clamp(Math.min(shl.x, hipl.x) - 10, 0, w - 2);
      const xTorsoR = clamp(Math.max(shr.x, hipr.x) + 10, xTorsoL + 2, w);
      const xMid = clamp((hipl.x + hipr.x) / 2, 0, w);

      const box = (x: number, y: number, bw: number, bh: number) => {
        const sx = clamp(Math.floor(x), 0, w - 1);
        const sy = clamp(Math.floor(y), 0, h - 1);
        const ex = clamp(Math.ceil(x + bw), sx + 1, w);
        const ey = clamp(Math.ceil(y + bh), sy + 1, h);
        return { sx, sy, sw: ex - sx, sh: ey - sy };
      };

      const slices = {
        head: box(xTorsoL - 10, yHeadTop, (xTorsoR - xTorsoL) + 20, yNeck - yHeadTop + 14),
        torso: box(xTorsoL, yNeck, xTorsoR - xTorsoL, yHip - yNeck + 12),
        arm_left: box(Math.min(shl.x - (xTorsoR - xTorsoL) * 0.45, xTorsoL - 24), yNeck, (xTorsoR - xTorsoL) * 0.55, yHip - yNeck + 8),
        arm_right: box(Math.max(shr.x - 8, xTorsoR - 24), yNeck, (xTorsoR - xTorsoL) * 0.55, yHip - yNeck + 8),
        leg_left: box(xTorsoL - 2, yHip, xMid - (xTorsoL - 2), yFoot - yHip),
        leg_right: box(xMid, yHip, xTorsoR - xMid + 2, yFoot - yHip),
      } as const;

      const cut = (s: { sx: number; sy: number; sw: number; sh: number }) => {
        const canvas = document.createElement("canvas");
        canvas.width = s.sw;
        canvas.height = s.sh;
        const ctx = canvas.getContext("2d");
        if (!ctx) return imageUrl;
        ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, 0, 0, s.sw, s.sh);
        return canvas.toDataURL("image/png");
      };

      const builtRig: RigData = {
        character: { width: w, height: h },
        parts: {
          head: {
            file: cut(slices.head),
            x: slices.head.sx,
            y: slices.head.sy,
            width: slices.head.sw,
            height: slices.head.sh,
            pivot_x: clamp(neck.x - slices.head.sx, 0, slices.head.sw),
            pivot_y: clamp(yNeck - slices.head.sy, 0, slices.head.sh),
            z: 5,
          },
          torso: {
            file: cut(slices.torso),
            x: slices.torso.sx,
            y: slices.torso.sy,
            width: slices.torso.sw,
            height: slices.torso.sh,
            pivot_x: Math.floor(slices.torso.sw / 2),
            pivot_y: 0,
            z: 3,
          },
          arm_left: {
            file: cut(slices.arm_left),
            x: slices.arm_left.sx,
            y: slices.arm_left.sy,
            width: slices.arm_left.sw,
            height: slices.arm_left.sh,
            pivot_x: clamp(shl.x - slices.arm_left.sx, 0, slices.arm_left.sw),
            pivot_y: clamp(shl.y - slices.arm_left.sy, 0, slices.arm_left.sh),
            z: 2,
          },
          arm_right: {
            file: cut(slices.arm_right),
            x: slices.arm_right.sx,
            y: slices.arm_right.sy,
            width: slices.arm_right.sw,
            height: slices.arm_right.sh,
            pivot_x: clamp(shr.x - slices.arm_right.sx, 0, slices.arm_right.sw),
            pivot_y: clamp(shr.y - slices.arm_right.sy, 0, slices.arm_right.sh),
            z: 2,
          },
          leg_left: {
            file: cut(slices.leg_left),
            x: slices.leg_left.sx,
            y: slices.leg_left.sy,
            width: slices.leg_left.sw,
            height: slices.leg_left.sh,
            pivot_x: clamp(hipl.x - slices.leg_left.sx, 0, slices.leg_left.sw),
            pivot_y: clamp(hipl.y - slices.leg_left.sy, 0, slices.leg_left.sh),
            z: 1,
          },
          leg_right: {
            file: cut(slices.leg_right),
            x: slices.leg_right.sx,
            y: slices.leg_right.sy,
            width: slices.leg_right.sw,
            height: slices.leg_right.sh,
            pivot_x: clamp(hipr.x - slices.leg_right.sx, 0, slices.leg_right.sw),
            pivot_y: clamp(hipr.y - slices.leg_right.sy, 0, slices.leg_right.sh),
            z: 1,
          },
        },
      };

      setRig(builtRig);
    };

    img.onerror = () => {
      if (!cancelled) setRig(null);
    };

    return () => {
      cancelled = true;
    };
  }, [imageUrl, rigPath, joints, hasUsableJoints, frameSizePx, riggedAt, allowJointFallback]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
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

  if (!rig) {
    const spriteStyle =
      mode === "walk"
        ? { transform: `translateY(${Math.abs(Math.sin(t * Math.PI * 2 * 1.8)) * -2}px) scaleX(${direction})` }
        : mode === "hop"
          ? { transform: `translateY(${-Math.max(0, Math.sin(t * Math.PI * 2 * 2)) * 8}px) scaleX(${direction})` }
          : { transform: `translateY(${Math.sin(t * 2.2) * 1.5}px) scaleX(${direction})` };

    return (
      <Image
        src={imageUrl}
        alt={name}
        fill
        sizes="112px"
        unoptimized
        className="object-cover"
        style={spriteStyle}
        draggable={false}
      />
    );
  }

  const fit = Math.min(frameSizePx / rig.character.width, frameSizePx / rig.character.height);

  return (
    <div className="absolute inset-0">
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: rig.character.width,
          height: rig.character.height,
          transform: `translateX(-50%) scale(${fit}) scaleX(${direction})`,
          transformOrigin: "50% 100%",
        }}
      >
        {orderedParts.map(([partName, part]) => {
          const pose = partPose(partName, t, mode);
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
              <Image
                src={resolvePartPath(rigPath, part.file)}
                alt={`${name}-${partName}`}
                fill
                sizes="112px"
                unoptimized
                className="object-contain"
                draggable={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
