import type { AIDifficulty, HeroClass, Rarity } from '../types';

export interface ClassMeta {
  id: HeroClass;
  label: string;
  icon: string;
  color: string;
  blurb: string;
}

export const CLASSES: Record<HeroClass, ClassMeta> = {
  tank: {
    id: 'tank',
    label: 'Tank',
    icon: 'Shield',
    color: '#7dd3fc',
    blurb: 'High defense, damage-soaking walls.',
  },
  fighter: {
    id: 'fighter',
    label: 'Fighter',
    icon: 'Swords',
    color: '#fb7185',
    blurb: 'Raw attack power and bruising brawls.',
  },
  speed: {
    id: 'speed',
    label: 'Speed',
    icon: 'Zap',
    color: '#facc15',
    blurb: 'Win the initiative and strike first.',
  },
  tactician: {
    id: 'tactician',
    label: 'Tactician',
    icon: 'Brain',
    color: '#a78bfa',
    blurb: 'Read the opponent, punish mistakes.',
  },
  special: {
    id: 'special',
    label: 'Special',
    icon: 'Flame',
    color: '#f97316',
    blurb: 'Fire, light and unnatural powers.',
  },
};

export interface RarityMeta {
  id: Rarity;
  label: string;
  color: string;
  glow: string;
  rank: number;
}

export const RARITIES: Record<Rarity, RarityMeta> = {
  common: { id: 'common', label: 'Common', color: '#93a4bf', glow: 'rgba(147,164,191,0.45)', rank: 0 },
  rare: { id: 'rare', label: 'Rare', color: '#38bdf8', glow: 'rgba(56,189,248,0.55)', rank: 1 },
  epic: { id: 'epic', label: 'Epic', color: '#c084fc', glow: 'rgba(192,132,252,0.6)', rank: 2 },
  legendary: { id: 'legendary', label: 'Legendary', color: '#ffc63d', glow: 'rgba(255,198,61,0.65)', rank: 3 },
};

export const DIFFICULTIES: Record<AIDifficulty, { label: string; blurb: string; stars: number }> = {
  rookie: { label: 'Rookie', blurb: 'Reckless and readable. Great for learning the ropes.', stars: 1 },
  hero: { label: 'Hero', blurb: 'Reads patterns and plays to its strengths.', stars: 2 },
  legend: { label: 'Legend', blurb: 'Predicts your habits and hunts for the kill.', stars: 3 },
};

export const CLASS_ORDER: HeroClass[] = ['tank', 'fighter', 'speed', 'tactician', 'special'];
export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
