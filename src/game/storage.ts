import { BALANCE } from './balance';
import { getHero, HERO_IDS, DEFAULT_DECK } from './data/heroes';
import { sanitizeDeck } from './engine';
import type { AIDifficulty } from './types';

const KEYS = {
  settings: 'superclash.settings.v1',
  stats: 'superclash.stats.v1',
  decks: 'superclash.decks.v1',
  unlocks: 'superclash.unlocks.v1',
} as const;

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  difficulty: AIDifficulty;
  playerName: string;
  screenShake: boolean;
}

export interface Stats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  roundsPlayed: number;
  bestHit: number;
  totalDamage: number;
  bestStreak: number;
  streak: number;
  perHero: Record<string, { plays: number; wins: number }>;
}

export interface SavedDecks {
  p1: string[];
  p2: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.35,
  sfxVolume: 0.75,
  muted: false,
  reducedMotion: false,
  difficulty: 'hero',
  playerName: 'Challenger',
  screenShake: true,
};

export const DEFAULT_STATS: Stats = {
  matches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  roundsPlayed: 0,
  bestHit: 0,
  totalDamage: 0,
  bestStreak: 0,
  streak: 0,
  perHero: {},
};

export const DEFAULT_DECKS: SavedDecks = {
  p1: [...DEFAULT_DECK],
  p2: [...DEFAULT_DECK],
};

/** Every hero is unlocked from the start; the hook exists for a future shop. */
export const DEFAULT_UNLOCKS: string[] = [...HERO_IDS];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the game must still run.
  }
}

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export function loadSettings(): Settings {
  const raw = read<Settings>(KEYS.settings, DEFAULT_SETTINGS);
  return {
    musicVolume: clamp01(raw.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    muted: Boolean(raw.muted),
    reducedMotion: Boolean(raw.reducedMotion),
    screenShake: raw.screenShake !== false,
    difficulty: raw.difficulty === 'rookie' || raw.difficulty === 'legend' || raw.difficulty === 'hero'
      ? raw.difficulty
      : DEFAULT_SETTINGS.difficulty,
    playerName:
      typeof raw.playerName === 'string' && raw.playerName.trim().length > 0
        ? raw.playerName.trim().slice(0, 16)
        : DEFAULT_SETTINGS.playerName,
  };
}

export function saveSettings(settings: Settings): void {
  write(KEYS.settings, settings);
}

export function loadStats(): Stats {
  const raw = read<Stats>(KEYS.stats, DEFAULT_STATS);
  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  const perHero: Stats['perHero'] = {};
  if (raw.perHero && typeof raw.perHero === 'object') {
    for (const [id, entry] of Object.entries(raw.perHero)) {
      if (!getHero(id) || !entry || typeof entry !== 'object') continue;
      const record = entry as { plays?: unknown; wins?: unknown };
      perHero[id] = { plays: num(record.plays), wins: num(record.wins) };
    }
  }
  return {
    matches: num(raw.matches),
    wins: num(raw.wins),
    losses: num(raw.losses),
    draws: num(raw.draws),
    roundsPlayed: num(raw.roundsPlayed),
    bestHit: num(raw.bestHit),
    totalDamage: num(raw.totalDamage),
    bestStreak: num(raw.bestStreak),
    streak: num(raw.streak),
    perHero,
  };
}

export function saveStats(stats: Stats): void {
  write(KEYS.stats, stats);
}

export function loadDecks(): SavedDecks {
  const raw = read<Partial<SavedDecks>>(KEYS.decks, DEFAULT_DECKS);
  return {
    p1: sanitizeDeck(raw.p1, DEFAULT_DECKS.p1),
    p2: sanitizeDeck(raw.p2, DEFAULT_DECKS.p2),
  };
}

export function saveDecks(decks: SavedDecks): void {
  write(KEYS.decks, decks);
}

export function loadUnlocks(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.unlocks);
    if (!raw) return DEFAULT_UNLOCKS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_UNLOCKS;
    const valid = parsed.filter((id): id is string => typeof id === 'string' && Boolean(getHero(id)));
    return valid.length > 0 ? [...new Set(valid)] : DEFAULT_UNLOCKS;
  } catch {
    return DEFAULT_UNLOCKS;
  }
}

export function saveUnlocks(ids: string[]): void {
  write(KEYS.unlocks, ids);
}

/** Records the outcome of a finished match. Pure except for persistence. */
export function recordMatch(
  stats: Stats,
  outcome: {
    result: 'win' | 'loss' | 'draw';
    mode: 'ai' | 'local';
    rounds: number;
    damage: number;
    bestHit: number;
    p1Deck: string[];
  },
): Stats {
  const perHero = { ...stats.perHero };
  for (const id of outcome.p1Deck) {
    const entry = perHero[id] ?? { plays: 0, wins: 0 };
    perHero[id] = entry;
  }
  const next: Stats = {
    ...stats,
    matches: stats.matches + 1,
    wins: stats.wins + (outcome.result === 'win' ? 1 : 0),
    losses: stats.losses + (outcome.result === 'loss' ? 1 : 0),
    draws: stats.draws + (outcome.result === 'draw' ? 1 : 0),
    roundsPlayed: stats.roundsPlayed + outcome.rounds,
    totalDamage: stats.totalDamage + outcome.damage,
    bestHit: Math.max(stats.bestHit, outcome.bestHit),
    perHero,
  };
  // Streaks only track solo play against the AI.
  if (outcome.mode === 'ai') {
    next.streak = outcome.result === 'win' ? stats.streak + 1 : 0;
    next.bestStreak = Math.max(stats.bestStreak, next.streak);
  }
  return next;
}

export function recordHeroPlays(stats: Stats, cardIds: string[], won: boolean): Stats {
  const perHero = { ...stats.perHero };
  for (const id of cardIds) {
    if (!getHero(id)) continue;
    const entry = perHero[id] ?? { plays: 0, wins: 0 };
    perHero[id] = { plays: entry.plays + 1, wins: entry.wins + (won ? 1 : 0) };
  }
  return { ...stats, perHero };
}

export const STORAGE_KEYS = KEYS;
export const MAX_DECK_SIZE = BALANCE.deckSize;
