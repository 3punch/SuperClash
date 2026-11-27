/**
 * SUPER CLASH — core types.
 * This module is UI-independent: nothing here imports React or touches the DOM.
 */

export type Side = 'p1' | 'p2';

export type HeroClass = 'tank' | 'fighter' | 'speed' | 'tactician' | 'special';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AbilityId =
  | 'aegis'
  | 'lastBastion'
  | 'frostbind'
  | 'bloodrage'
  | 'duelist'
  | 'crushing'
  | 'afterimage'
  | 'staticcharge'
  | 'blinkstrike'
  | 'countermeasures'
  | 'riposte'
  | 'precognition'
  | 'ignition'
  | 'refract'
  | 'regrowth'
  | 'overcharge';

export interface HeroCard {
  id: string;
  name: string;
  epithet: string;
  class: HeroClass;
  attack: number;
  defense: number;
  speed: number;
  energyCost: number;
  rarity: Rarity;
  abilityId: AbilityId;
  /** Short one-liner shown on the card face. */
  description: string;
  artwork: string;
  /** Per-hero accent colour used for glow / FX. */
  accent: string;
  /** Two-letter monogram shown on compact counters. */
  monogram: string;
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  kind: 'passive' | 'onAttack' | 'onDefend' | 'oncePerMatch' | 'roundEnd';
  /** Full, plain-language rules text. */
  rules: string;
  /** Very short label for FX banners. */
  shout: string;
  icon: string;
  color: string;
}

export interface BurnState {
  damage: number;
  roundsLeft: number;
  /** Round in which the burn was applied (used to avoid double-ticks). */
  appliedRound: number;
  sourceSide: Side;
  sourceName: string;
}

export interface FighterSnapshot {
  side: Side;
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  burn: BurnState | null;
  /** Ability ids already consumed for the match (e.g. afterimage). */
  usedOnce: AbilityId[];
  /** Classes the fighter has already played, oldest first. */
  classHistory: HeroClass[];
  cardHistory: string[];
}

export interface BonusLine {
  label: string;
  value: number;
}

export type CombatEvent =
  | { type: 'ability'; side: Side; abilityId: AbilityId; label: string }
  | { type: 'attack'; side: Side; amount: number; label: string }
  | { type: 'block'; side: Side; label: string }
  | { type: 'dodge'; side: Side; label: string }
  | { type: 'reflect'; side: Side; amount: number; label: string }
  | { type: 'riposte'; side: Side; amount: number; label: string }
  | { type: 'burn'; side: Side; amount: number; label: string }
  | { type: 'heal'; side: Side; amount: number; label: string }
  | { type: 'speed'; side: Side; label: string }
  | { type: 'ko'; side: Side; label: string };

export interface SideOutcome {
  side: Side;
  cardId: string;
  cardName: string;
  attackBase: number;
  attackBonuses: BonusLine[];
  effectiveAttack: number;
  defenseBase: number;
  defenseBonuses: BonusLine[];
  effectiveDefense: number;
  speed: number;
  speedEdge: number;
  speedBonus: number;
  /** Damage this side's attack pushed through the opposing guard. */
  clashDamage: number;
  /** Net HP this side lost this round (after healing). Shown on the HP bar. */
  damageTaken: number;
  /** Total damage this side inflicted, all sources. */
  damageDealt: number;
  blocked: boolean;
  dodged: boolean;
  healed: number;
  burned: number;
  /** True when this side set the opponent alight this round. */
  appliedBurn: boolean;
  events: CombatEvent[];
  notes: string[];
}

/** Explicit beat list so the UI can stage the reveal without inventing logic. */
export type BeatKind = 'ability' | 'dodge' | 'block' | 'reflect' | 'riposte' | 'burn' | 'heal' | 'ko';

export interface RoundBeat {
  id: string;
  kind: BeatKind;
  /** The side that *owns* the effect (the defender for blocks/dodges). */
  side: Side;
  label: string;
  amount: number;
  abilityId?: AbilityId;
}

export interface RoundResult {
  round: number;
  p1: SideOutcome;
  p2: SideOutcome;
  hpBefore: Record<Side, number>;
  hpAfter: Record<Side, number>;
  events: CombatEvent[];
  explanation: string[];
  /** Winning side of the round, or null when the round is even. */
  roundWinner: Side | null;
  /** Staged presentation timeline, ordered by intended reveal beat. */
  beats: RoundBeat[];
  /** Headline shown in the round banner, e.g. "RAVAGER BREAKS THROUGH". */
  headline: string;
}

export interface RoundInput {
  round: number;
  cards: Record<Side, HeroCard>;
  fighters: Record<Side, FighterSnapshot>;
}

export type MatchMode = 'ai' | 'local';

export type AIDifficulty = 'rookie' | 'hero' | 'legend';

export type MatchPhase =
  | 'p1-select'
  | 'handoff'
  | 'p2-select'
  | 'reveal'
  | 'round-end'
  | 'match-end';

export interface FighterState {
  side: Side;
  name: string;
  isAI: boolean;
  difficulty: AIDifficulty | null;
  hp: number;
  maxHp: number;
  energy: number;
  deck: string[];
  drawPile: string[];
  hand: string[];
  used: string[];
  burn: BurnState | null;
  usedOnce: AbilityId[];
  classHistory: HeroClass[];
  cardHistory: string[];
  damageDealt: number;
  bestHit: number;
}

export interface LogEntry {
  round: number;
  text: string;
  tone: 'neutral' | 'good' | 'bad' | 'special';
}

export interface MatchState {
  id: string;
  mode: MatchMode;
  round: number;
  maxRounds: number;
  phase: MatchPhase;
  fighters: Record<Side, FighterState>;
  /** Hidden selections. Never render the opponent's value before reveal. */
  pending: Record<Side, string | null>;
  lastResult: RoundResult | null;
  log: LogEntry[];
  winner: Side | 'draw' | null;
  seed: number;
}

export interface Playability {
  ok: boolean;
  reason: string | null;
  /** True when the fighter is short on energy but has no affordable card. */
  freePlay: boolean;
}
