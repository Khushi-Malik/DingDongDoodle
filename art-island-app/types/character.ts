// TypeScript interfaces for the Art Island app

export interface PersonalityData {
  catchphrase: string;
  traits: string[];
  dailyActivity: string;
  favoriteThing: string;
}

export interface CharacterData {
  id: string;
  imageUrl: string;
  name: string;
  age: number;
  position: { x: number; y: number };
}

export interface Character {
  id: string;
  name: string;
  age: number;
  image_url: string;
  position_x: number;
  position_y: number;
  created_at: string;
}
