"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Star {
  id: number;
  width: number;
  height: number;
  top: number;
  left: number;
  opacity: number;
}

interface Island {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  delay: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [stars, setStars] = useState<Star[]>([]);
  const [islands, setIslands] = useState<Island[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        width: Math.random() * 3 + 1,
        height: Math.random() * 3 + 1,
        top: Math.random() * 100,
        left: Math.random() * 100,
        opacity: Math.random() * 0.7 + 0.3,
      })),
    );

    setIslands([
      { id: 1, x: 15, y: 40, size: 120, color: "from-green-600 to-green-700", rotation: 0, delay: 0 },
      { id: 2, x: 50, y: 50, size: 150, color: "from-emerald-500 to-emerald-700", rotation: 15, delay: 1 },
      { id: 3, x: 80, y: 35, size: 100, color: "from-teal-600 to-teal-700", rotation: -10, delay: 2 },
      { id: 4, x: 28, y: 65, size: 90, color: "from-green-700 to-green-800", rotation: 5, delay: 3 },
      { id: 5, x: 65, y: 70, size: 110, color: "from-emerald-600 to-emerald-800", rotation: -20, delay: 4 },
    ]);
  }, []);

  return (
    <div
      className="size-full relative overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Subtle overlay to keep text readable */}
      <div className="absolute inset-0 bg-white/40" />

      {/* Stars background */}
      <div className="absolute inset-0 hidden">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute bg-white rounded-full"
            style={{
              width: star.width + "px",
              height: star.height + "px",
              top: star.top + "%",
              left: star.left + "%",
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center mb-12">
        <div className="bg-white/70 backdrop-blur-sm px-24 py-6 shadow-lg flex flex-col items-center gap-6 rounded">
          <h1 className="text-5xl md:text-7xl font-bold text-black drop-shadow-lg">
            Art Island
          </h1>
          <p className="text-gray-700 text-xl mt-2">
            Where Your Drawings Come to Life :D
          </p>
          <button
            onClick={() => router.push("/login")}
            className="bg-black text-white font-bold mt-5 px-10 py-4 text-xl rounded hover:-translate-y-1 transition-transform"
          >
            Explore
          </button>
        </div>
      </div>
    </div>
  );
}