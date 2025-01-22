export interface Word {
  text: string;
  audioPath: string;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  isAlive: boolean;
}

export interface GameState {
  difficulty: Difficulty;
  currentWord: Word | null;
  players: Player[];
  spectators: string[];
  isActive: boolean;
  scores: Map<string, number>;
} 