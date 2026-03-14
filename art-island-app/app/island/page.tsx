'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { Plus, LogOut } from 'lucide-react';
import { Character } from '../components/Character';
import { CharacterDetail } from '../components/CharacterDetail';
import { UploadModal } from '../components/UploadModal';

interface CharacterData {
  id: string;
  imageUrl: string;
  name: string;
  age: number;
  position: { x: number; y: number };
}

export default function App() {
  const router = useRouter();
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [towerColor, setTowerColor] = useState(0);

  const stars = useMemo(() =>
    Array.from({ length: 100 }, (_, i) => ({
      id: i,
      width: Math.random() * 3 + 1,
      height: Math.random() * 3 + 1,
      top: Math.random() * 70,
      opacity: Math.random() * 0.7 + 0.3,
      animationDelay: Math.random() * -120,
    })),
  []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTowerColor((prev) => (prev + 36) % 360);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const mappedCharacters: CharacterData[] = data.map((char: any) => ({
        id: char.id,
        imageUrl: char.imageUrl,
        name: char.name,
        age: char.age,
        position: char.position,
      }));
      setCharacters(mappedCharacters);
    } catch (error) {
      console.error('Error loading characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  };

  const getValidCharacterPosition = (): { x: number; y: number } => {
    const minDistance = 8;
    const maxAttempts = 10;
    let attempt = 0;
    while (attempt < maxAttempts) {
      const x = Math.random() * 30 + 35;
      const y = 30 + Math.random() * 2;
      const isFarEnough = characters.every((char) => {
        const distance = Math.sqrt(
          Math.pow(x - char.position.x, 2) + Math.pow(y - char.position.y, 2)
        );
        return distance >= minDistance;
      });
      if (isFarEnough) return { x, y };
      attempt++;
    }
    return { x: Math.random() * 30 + 35, y: 30 + Math.random() * 2 };
  };

  const handleAddCharacter = async (imageFile: File, name: string, age: number) => {
    try {
      const position = getValidCharacterPosition();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, imageUrl: base64, position }),
      });

      if (!res.ok) throw new Error('Failed to save');
      const newCharacter = await res.json();
      setCharacters((prev) => [...prev, newCharacter]);
    } catch (error) {
      console.error('Error adding character:', error);
      alert('Failed to add character. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-b from-black via-indigo-950 to-indigo-900">
        <div className="text-2xl text-white drop-shadow-lg">Loading the CN Tower... 🗼</div>
      </div>
    );
  }

  return (
    <div className="size-full relative overflow-hidden bg-gradient-to-b from-black via-indigo-950 to-indigo-900">
      {/* Stars */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute bg-white rounded-full animate-star-drift"
            style={{
              width: star.width + 'px',
              height: star.height + 'px',
              top: star.top + '%',
              opacity: star.opacity,
              animationDelay: star.animationDelay + 's',
            }}
          />
        ))}
      </div>

      {/* CN Tower Structure */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div
          className="relative w-0 h-0"
          style={{
            borderLeft: 'calc(80px * var(--tower-scale)) solid transparent',
            borderRight: 'calc(80px * var(--tower-scale)) solid transparent',
            borderBottom: 'calc(400px * var(--tower-scale)) solid #6b7280',
            filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5))',
          }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-gray-400"
            style={{
              width: 'calc(4px * var(--tower-scale))',
              height: 'calc(120px * var(--tower-scale))',
              bottom: 'calc(400px * var(--tower-scale))',
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-red-500 animate-pulse"
            style={{
              width: 'calc(16px * var(--tower-scale))',
              height: 'calc(16px * var(--tower-scale))',
              bottom: 'calc(510px * var(--tower-scale))',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)',
            }}
          />
        </div>

        <div className="relative flex flex-col items-center">
          <div className="w-[400px] h-16 bg-gradient-to-b from-gray-300 to-gray-400 rounded-t-full shadow-lg" />
          <div className="relative w-[500px] h-40 bg-gradient-to-b from-gray-500 to-gray-600 rounded-full shadow-2xl flex items-center justify-center">
            <div
              className="absolute rounded-full transition-all duration-1000 ease-in-out"
              style={{
                width: 'calc(420px * var(--tower-scale))',
                height: 'calc(128px * var(--tower-scale))',
                background: `linear-gradient(to bottom, hsla(${towerColor}, 80%, 60%, 0.6), hsla(${towerColor}, 80%, 50%, 0.8))`,
                boxShadow: `inset 0 0 40px hsla(${towerColor}, 80%, 60%, 0.8), 0 0 60px hsla(${towerColor}, 80%, 60%, 0.5)`,
              }}
            >
              <div className="absolute inset-4 bg-gray-700/40 rounded-full" />
            </div>
          </div>
          <div className="relative w-[600px] h-24 bg-gradient-to-b from-gray-600 to-gray-700 rounded-full shadow-xl mt-[-10px]">
            <div className="absolute inset-0 rounded-full" style={{ border: '3px solid #9ca3af' }} />
          </div>
          <div className="bg-gradient-to-b from-gray-700 to-gray-800 rounded-b-full shadow-xl"
            style={{ width: 'calc(420px * var(--tower-scale))', height: 'calc(64px * var(--tower-scale))' }} />
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 shadow-2xl"
            style={{ width: 'calc(128px * var(--tower-scale))', height: 'calc(96px * var(--tower-scale))' }} />
          <div className="bg-black/50 rounded-full blur-md"
            style={{ width: 'calc(160px * var(--tower-scale))', height: 'calc(12px * var(--tower-scale))' }} />
        </div>
      </div>

      {/* Characters */}
      <div className="absolute inset-0">
        {characters.map((character) => (
          <Character key={character.id} {...character} onClick={() => setSelectedCharacter(character)} />
        ))}
      </div>

      {/* Add Button */}
      <button
        onClick={() => setShowUploadModal(true)}
        className="fixed top-4 sm:top-6 left-4 sm:left-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 z-10 text-sm sm:text-base"
      >
        <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="hidden sm:inline">Add Drawing</span>
        <span className="sm:hidden">Add</span>
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="fixed top-4 sm:top-6 right-4 sm:right-6 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2 z-10 text-sm"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Log Out</span>
      </button>

      {/* Title */}
      <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 text-center z-10 px-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
          CN Tower Observation Deck
        </h1>
        <p className="text-white/90 text-xs sm:text-sm md:text-base lg:text-lg mt-1 drop-shadow">
          Toronto, Ontario 🇨🇦
        </p>
      </div>

      {/* Empty State */}
      {characters.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center px-4">
          <p className="text-lg sm:text-xl md:text-2xl text-white/80 drop-shadow">
            Click "Add Drawing" to bring your art to the CN Tower! 🎨
          </p>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {selectedCharacter && (
          <CharacterDetail {...selectedCharacter} onClose={() => setSelectedCharacter(null)} />
        )}
        {showUploadModal && (
          <UploadModal onClose={() => setShowUploadModal(false)} onSubmit={handleAddCharacter} />
        )}
      </AnimatePresence>
    </div>
  );
}