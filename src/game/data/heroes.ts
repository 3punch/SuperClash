import type { HeroCard } from '../types';

export const ART = {
  heroes: '/art/heroes',
  backgrounds: '/art/bg',
} as const;

/**
 * The roster. Everything balance-related is data — add a hero by appending here.
 * All characters, names and designs are original creations for SUPER CLASH.
 */
export const HEROES: HeroCard[] = [
  // ── TANKS ────────────────────────────────────────────────────────────────
  {
    id: 'ironclad',
    name: 'Ironclad',
    epithet: 'The Unbreakable',
    class: 'tank',
    attack: 4,
    defense: 7,
    speed: 3,
    energyCost: 3,
    rarity: 'common',
    abilityId: 'aegis',
    description: 'A living bunker. Nothing gets through the plating.',
    artwork: `${ART.heroes}/ironclad.webp`,
    accent: '#7dd3fc',
    monogram: 'IC',
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    epithet: 'Shield of the City',
    class: 'tank',
    attack: 5,
    defense: 6,
    speed: 2,
    energyCost: 4,
    rarity: 'rare',
    abilityId: 'lastBastion',
    description: 'The lower his health, the harder he digs in.',
    artwork: `${ART.heroes}/bulwark.webp`,
    accent: '#38bdf8',
    monogram: 'BW',
  },
  {
    id: 'mammoth',
    name: 'Mammoth',
    epithet: 'Glacier Born',
    class: 'tank',
    attack: 6,
    defense: 5,
    speed: 1,
    energyCost: 5,
    rarity: 'epic',
    abilityId: 'frostbind',
    description: 'Slow to arrive. Impossible to move.',
    artwork: `${ART.heroes}/mammoth.webp`,
    accent: '#93c5fd',
    monogram: 'MM',
  },

  // ── FIGHTERS ─────────────────────────────────────────────────────────────
  {
    id: 'ravager',
    name: 'Ravager',
    epithet: 'The Red Wrath',
    class: 'fighter',
    attack: 8,
    defense: 3,
    speed: 6,
    energyCost: 3,
    rarity: 'common',
    abilityId: 'bloodrage',
    description: 'Hits hardest when he is nearly out.',
    artwork: `${ART.heroes}/ravager.webp`,
    accent: '#ef4444',
    monogram: 'RV',
  },
  {
    id: 'kairo',
    name: 'Kairo',
    epithet: 'Blade of Dawn',
    class: 'fighter',
    attack: 7,
    defense: 3,
    speed: 5,
    energyCost: 2,
    rarity: 'rare',
    abilityId: 'duelist',
    description: 'A principled swordsman who never backs down.',
    artwork: `${ART.heroes}/kairo.webp`,
    accent: '#fbbf24',
    monogram: 'KI',
  },
  {
    id: 'gravlord',
    name: 'Grav-Lord',
    epithet: 'Master of Mass',
    class: 'fighter',
    attack: 6,
    defense: 5,
    speed: 2,
    energyCost: 4,
    rarity: 'legendary',
    abilityId: 'crushing',
    description: 'Armour only makes his gravity wells stronger.',
    artwork: `${ART.heroes}/gravlord.webp`,
    accent: '#a78bfa',
    monogram: 'GL',
  },

  // ── SPEED ────────────────────────────────────────────────────────────────
  {
    id: 'zephyra',
    name: 'Zephyra',
    epithet: 'The Living Gale',
    class: 'speed',
    attack: 5,
    defense: 2,
    speed: 9,
    energyCost: 3,
    rarity: 'epic',
    abilityId: 'afterimage',
    description: 'You will hit her eventually. Probably.',
    artwork: `${ART.heroes}/zephyra.webp`,
    accent: '#fde047',
    monogram: 'ZP',
  },
  {
    id: 'voltrex',
    name: 'Voltrex',
    epithet: 'Thunder Runner',
    class: 'speed',
    attack: 6,
    defense: 2,
    speed: 8,
    energyCost: 2,
    rarity: 'common',
    abilityId: 'staticcharge',
    description: 'Fast enough to hit before the thunder lands.',
    artwork: `${ART.heroes}/voltrex.webp`,
    accent: '#facc15',
    monogram: 'VX',
  },
  {
    id: 'shiv',
    name: 'Shiv',
    epithet: 'Ghost in the Static',
    class: 'speed',
    attack: 7,
    defense: 2,
    speed: 7,
    energyCost: 4,
    rarity: 'rare',
    abilityId: 'blinkstrike',
    description: 'Blink. Strike. Gone before the armour matters.',
    artwork: `${ART.heroes}/shiv.webp`,
    accent: '#c084fc',
    monogram: 'SV',
  },

  // ── TACTICIANS ───────────────────────────────────────────────────────────
  {
    id: 'sentinel',
    name: 'Sentinel',
    epithet: 'The Night Analyst',
    class: 'tactician',
    attack: 5,
    defense: 4,
    speed: 5,
    energyCost: 3,
    rarity: 'common',
    abilityId: 'countermeasures',
    description: 'Every pattern is a door left open.',
    artwork: `${ART.heroes}/sentinel.webp`,
    accent: '#a78bfa',
    monogram: 'SN',
  },
  {
    id: 'echo',
    name: 'Echo',
    epithet: 'Mirror of War',
    class: 'tactician',
    attack: 4,
    defense: 5,
    speed: 5,
    energyCost: 2,
    rarity: 'rare',
    abilityId: 'riposte',
    description: 'What you send out comes back sharper.',
    artwork: `${ART.heroes}/echo.webp`,
    accent: '#7dd3fc',
    monogram: 'EC',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    epithet: 'The Tomorrow Eye',
    class: 'tactician',
    attack: 5,
    defense: 4,
    speed: 6,
    energyCost: 4,
    rarity: 'epic',
    abilityId: 'precognition',
    description: 'She has already seen how this round ends.',
    artwork: `${ART.heroes}/oracle.webp`,
    accent: '#c4b5fd',
    monogram: 'OR',
  },

  // ── SPECIAL ──────────────────────────────────────────────────────────────
  {
    id: 'pyroclast',
    name: 'Pyroclast',
    epithet: 'Volcano Heart',
    class: 'special',
    attack: 7,
    defense: 2,
    speed: 6,
    energyCost: 3,
    rarity: 'rare',
    abilityId: 'ignition',
    description: 'His fire does not stop when the punch does.',
    artwork: `${ART.heroes}/pyroclast.webp`,
    accent: '#fb923c',
    monogram: 'PY',
  },
  {
    id: 'prism',
    name: 'Prism',
    epithet: 'The Radiant Blade',
    class: 'special',
    attack: 5,
    defense: 5,
    speed: 4,
    energyCost: 3,
    rarity: 'epic',
    abilityId: 'refract',
    description: 'Light in, laser out. Stand clear.',
    artwork: `${ART.heroes}/prism.webp`,
    accent: '#e879f9',
    monogram: 'PR',
  },
  {
    id: 'thornwild',
    name: 'Thornwild',
    epithet: 'Root of the Wild',
    class: 'special',
    attack: 5,
    defense: 4,
    speed: 5,
    energyCost: 5,
    rarity: 'legendary',
    abilityId: 'regrowth',
    description: 'Cut him down and the forest grows back.',
    artwork: `${ART.heroes}/thornwild.webp`,
    accent: '#4ade80',
    monogram: 'TW',
  },
  {
    id: 'arcwraith',
    name: 'Arcwraith',
    epithet: 'Storm Made Flesh',
    class: 'special',
    attack: 6,
    defense: 2,
    speed: 8,
    energyCost: 4,
    rarity: 'legendary',
    abilityId: 'overcharge',
    description: 'No wall stops lightning.',
    artwork: `${ART.heroes}/arcwraith.webp`,
    accent: '#67e8f9',
    monogram: 'AW',
  },
];

/**
 * Heroes whose artwork files currently exist. Kept explicit so the UI can show
 * a designed placeholder instead of a broken image while remaining art is
 * still being produced.
 */
export const HERO_ART_AVAILABLE = new Set<string>([
  'ironclad',
  'bulwark',
  'mammoth',
  'ravager',
  'kairo',
  'gravlord',
  'zephyra',
  'voltrex',
  'shiv',
]);

const HERO_INDEX: Record<string, HeroCard> = Object.fromEntries(
  HEROES.map((hero) => [hero.id, hero]),
);

export function getHero(id: string): HeroCard | undefined {
  return HERO_INDEX[id];
}

/** Throws if the id is unknown — callers handling user data must validate first. */
export function requireHero(id: string): HeroCard {
  const hero = HERO_INDEX[id];
  if (!hero) throw new Error(`Unknown hero id: ${id}`);
  return hero;
}

export const HERO_IDS = HEROES.map((hero) => hero.id);

export interface DeckPreset {
  id: string;
  name: string;
  blurb: string;
  cards: string[];
}

/** Ready-made decks for quick play and as a starting point in the deck builder. */
export const DECK_PRESETS: DeckPreset[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    blurb: 'Balanced frontline with hard-hitting finishers.',
    cards: ['kairo', 'voltrex', 'echo', 'ironclad', 'ravager', 'sentinel', 'pyroclast', 'prism'],
  },
  {
    id: 'blitz',
    name: 'Blitz',
    blurb: 'Overwhelming speed. Strike before they can react.',
    cards: ['voltrex', 'kairo', 'echo', 'zephyra', 'shiv', 'arcwraith', 'ravager', 'pyroclast'],
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut',
    blurb: 'Immovable walls that outlast everything.',
    cards: ['kairo', 'echo', 'voltrex', 'ironclad', 'bulwark', 'mammoth', 'gravlord', 'thornwild'],
  },
];

export const DEFAULT_DECK = DECK_PRESETS[0].cards;
