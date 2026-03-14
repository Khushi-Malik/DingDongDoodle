'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Star {
  id: number;
  width: number;
  height: number;
  top: number;
  left: number;
  opacity: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [towerColor, setTowerColor] = useState(0);
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 100 }, (_, i) => ({
        id: i,
        width: Math.random() * 3 + 1,
        height: Math.random() * 3 + 1,
        top: Math.random() * 100,
        left: Math.random() * 100,
        opacity: Math.random() * 0.7 + 0.3,
      }))
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTowerColor((prev) => (prev + 36) % 360);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="size-full relative overflow-hidden bg-gradient-to-b from-black via-indigo-950 to-indigo-900 flex flex-col items-center justify-center">
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute bg-white rounded-full"
            style={{
              width: star.width + 'px',
              height: star.height + 'px',
              top: star.top + '%',
              left: star.left + '%',
              opacity: star.opacity,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-lg">CN Tower</h1>
        <p className="text-white/70 text-xl mt-3">Observation Deck — Toronto, Ontario 🇨🇦</p>
      </div>

      <button
        onClick={() => router.push('/login')}
        className="relative z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-10 py-4 rounded-full text-xl shadow-lg hover:shadow-pink-500/40 hover:scale-105 transition-all"
      >
        Enter the Tower 🗼
      </button>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40">
        <div className="relative w-0 h-0"
          style={{
            borderLeft: '80px solid transparent',
            borderRight: '80px solid transparent',
            borderBottom: '400px solid #6b7280',
          }}
        >
          <div className="absolute left-1/2 -translate-x-1/2 bg-gray-400 w-1 h-28"
            style={{ bottom: '400px' }} />
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-red-500 animate-pulse w-4 h-4"
            style={{ bottom: '510px', transform: 'translateX(-50%)' }} />
        </div>
        <div className="w-96 h-16 bg-gradient-to-b from-gray-300 to-gray-400 rounded-t-full" />
        <div className="relative w-[500px] h-40 bg-gradient-to-b from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
          <div className="absolute rounded-full w-[420px] h-32 transition-all duration-1000"
            style={{
              background: `linear-gradient(to bottom, hsla(${towerColor}, 80%, 60%, 0.6), hsla(${towerColor}, 80%, 50%, 0.8))`,
              boxShadow: `0 0 60px hsla(${towerColor}, 80%, 60%, 0.5)`,
            }} />
        </div>
      </div>
    </div>
  );
}