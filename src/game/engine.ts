import { BALANCE } from './balance';
import { resolveRound } from './combat';
import { getHero, requireHero } from './data/heroes';
import type {
  AbilityId,
  AIDifficulty,
  BurnState,
  FighterSnapshot,
  FighterState,
  HeroCard,
  LogEntry,
  MatchMode,
  MatchState,
  Playability,
  RoundInput,
  RoundResult,
  Side,
} from './types';

export const OTHER: Record<Side, Side> = { p1: 'p2', p2: 'p1' };
export const SIDES: Side[] = ['p1', 'p2'];

export interface MatchSetup {
  mode: MatchMode;
  p1Name: string;
  p2Name: string;
  p1Deck: string[];
  p2Deck: string[];
  p2Difficulty?: AIDifficulty | null;
  /** Deterministic shuffles for tests. */
  seed?: number;
}

// ── Deterministic shuffle ───────────────────────────────────────────────────

/** Mulberry32 — tiny deterministic PRNG so shuffles are seedable in tests. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ── Deck validation ────────────────────────────────────────────────────────

export interface DeckCheck {
  valid: boolean;
  reasons: string[];
}

/** Validates a player-chosen deck (unknown ids, duplicates, size, energy mix). */
export function validateDeck(deck: string[]): DeckCheck {
  const reasons: string[] = [];
  const unique = new Set(deck);
  if (deck.length !== BALANCE.deckSize) {
    reasons.push(`A deck needs exactly ${BALANCE.deckSize} cards.`);
  }
  if (unique.size !== deck.length) {
    reasons.push('Every card in a deck must be unique.');
  }
  const unknown = deck.filter((id) => !getHero(id));
  if (unknown.length > 0) {
    reasons.push(`Unknown card${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`);
  }
  const heroes = deck.map(getHero).filter((hero): hero is HeroCard => Boolean(hero));
  const cheap = heroes.filter((hero) => hero.energyCost <= BALANCE.cheapCost);
  if (heroes.length > 0 && cheap.length < BALANCE.minCheapCards) {
    reasons.push(`Include at least ${BALANCE.minCheapCards} cards costing ${BALANCE.cheapCost} energy or less.`);
  }
  return { valid: reasons.length === 0, reasons };
}

/** Repairs untrusted data (e.g. a deck saved by an older build). */
export function sanitizeDeck(deck: unknown, fallback: string[]): string[] {
  if (!Array.isArray(deck)) return fallback;
  const ids = deck.filter((id): id is string => typeof id === 'string' && Boolean(getHero(id)));
  const unique = [...new Set(ids)].slice(0, BALANCE.deckSize);
  return unique.length === BALANCE.deckSize ? unique : fallback;
}

// ── Fighter construction ───────────────────────────────────────────────────

export function createFighter(params: {
  side: Side;
  name: string;
  deck: string[];
  isAI?: boolean;
  difficulty?: AIDifficulty | null;
}): FighterState {
  const { side, name, deck, isAI = false, difficulty = null } = params;
  return {
    side,
    name,
    isAI,
    difficulty,
    hp: BALANCE.maxHp,
    maxHp: BALANCE.maxHp,
    energy: BALANCE.energyStart,
    deck: [...deck],
    drawPile: [...deck],
    hand: [],
    used: [],
    burn: null,
    usedOnce: [],
    classHistory: [],
    cardHistory: [],
    damageDealt: 0,
    bestHit: 0,
  };
}

function draw(fighter: FighterState, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const next = fighter.drawPile.shift();
    if (next) fighter.hand.push(next);
  }
}

/** Opening draws: three cards each, then close the draw pile for the match. */
function dealOpeningHands(state: MatchState): void {
  for (const side of SIDES) {
    draw(state.fighters[side], BALANCE.handSize);
  }
}

export function createMatch(setup: MatchSetup): MatchState {
  const seed = setup.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);

  const p1 = createFighter({
    side: 'p1',
    name: setup.p1Name || 'Player 1',
    deck: shuffle(setup.p1Deck, rng),
  });
  const p2 = createFighter({
    side: 'p2',
    name: setup.p2Name || (setup.mode === 'ai' ? 'A.I. Opponent' : 'Player 2'),
    deck: shuffle(setup.p2Deck, rng),
    isAI: setup.mode === 'ai',
    difficulty: setup.mode === 'ai' ? (setup.p2Difficulty ?? 'hero') : null,
  });

  const state: MatchState = {
    id: `match-${seed}`,
    mode: setup.mode,
    round: 1,
    maxRounds: BALANCE.maxRounds,
    phase: 'p1-select',
    fighters: { p1, p2 },
    pending: { p1: null, p2: null },
    lastResult: null,
    log: [
      {
        round: 1,
        text: `${p1.name} vs ${p2.name} — 20 HP each. Best of ${BALANCE.maxRounds} rounds.`,
        tone: 'neutral',
      },
    ],
    winner: null,
    seed,
  };
  dealOpeningHands(state);
  return state;
}

// ── Queries ────────────────────────────────────────────────────────────────

export function getFighter(state: MatchState, side: Side): FighterState {
  return state.fighters[side];
}

export function handCards(fighter: FighterState): HeroCard[] {
  return fighter.hand.map((id) => requireHero(id));
}

export function canPlay(fighter: FighterState, cardId: string): Playability {
  if (fighter.used.includes(cardId)) {
    return { ok: false, reason: 'That card was already played this match.', freePlay: false };
  }
  if (!fighter.hand.includes(cardId)) {
    return { ok: false, reason: 'That card is not in hand.', freePlay: false };
  }
  const card = getHero(cardId);
  if (!card) {
    return { ok: false, reason: 'Unknown card.', freePlay: false };
  }
  const affordable = fighter.hand.some((id) => {
    const candidate = getHero(id);
    return candidate !== undefined && candidate.energyCost <= fighter.energy;
  });
  if (card.energyCost > fighter.energy) {
    // Anti-stall: if nothing in hand is affordable, the cheapest card plays free.
    if (!affordable) {
      return { ok: true, reason: null, freePlay: true };
    }
    return { ok: false, reason: `Not enough energy — ${card.name} costs ${card.energyCost}.`, freePlay: false };
  }
  return { ok: true, reason: null, freePlay: false };
}

export function getSnapshot(fighter: FighterState): FighterSnapshot {
  return {
    side: fighter.side,
    name: fighter.name,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    energy: fighter.energy,
    burn: fighter.burn ? { ...fighter.burn } : null,
    usedOnce: [...fighter.usedOnce],
    classHistory: [...fighter.classHistory],
    cardHistory: [...fighter.cardHistory],
  };
}

// ── Actions (pure: always return a new state) ──────────────────────────────

function pushLog(state: MatchState, text: string, tone: LogEntry['tone'] = 'neutral'): MatchState {
  return {
    ...state,
    log: [...state.log, { round: state.round, text, tone }].slice(-60),
  };
}

/** Record a hidden selection. Only the acting side may select. */
export function selectCard(state: MatchState, side: Side, cardId: string): MatchState {
  const expected: Record<string, Side> = { 'p1-select': 'p1', 'p2-select': 'p2' };
  const active = expected[state.phase];
  if (!active) return state;
  if (active !== side) return state;
  if (state.pending[side]) return state;

  const fighter = state.fighters[side];
  if (!canPlay(fighter, cardId).ok) return state;

  return {
    ...state,
    pending: { ...state.pending, [side]: cardId },
  };
}

/**
 * Commit both selections and resolve the round.
 * Anything short of two valid, distinct hidden selections is rejected.
 */
export function commitRound(state: MatchState): MatchState {
  if (state.phase !== 'p2-select' && state.phase !== 'reveal') return state;
  if (state.phase === 'reveal' && state.lastResult) return state;

  const p1CardId = state.pending.p1;
  const p2CardId = state.pending.p2;
  if (!p1CardId || !p2CardId) return state;
  if (!state.fighters.p1.hand.includes(p1CardId)) return state;
  if (!state.fighters.p2.hand.includes(p2CardId)) return state;

  const p1Card = requireHero(p1CardId);
  const p2Card = requireHero(p2CardId);
  const fighterSnapshots = { p1: getSnapshot(state.fighters.p1), p2: getSnapshot(state.fighters.p2) };

  const input: RoundInput = {
    round: state.round,
    cards: { p1: p1Card, p2: p2Card },
    fighters: fighterSnapshots,
  };
  const result = resolveRound(input);

  return applyRoundResult(state, result, p1Card, p2Card);
}

function applyRoundResult(
  state: MatchState,
  result: RoundResult,
  p1Card: HeroCard,
  p2Card: HeroCard,
): MatchState {
  const fighters = { ...state.fighters };
  const cards: Record<Side, HeroCard> = { p1: p1Card, p2: p2Card };

  for (const side of SIDES) {
    const fighter = { ...fighters[side] };
    const card = cards[side];
    const outcome = result[side];

    fighter.hp = result.hpAfter[side];
    fighter.hand = fighter.hand.filter((id) => id !== card.id);
    fighter.used = [...fighter.used, card.id];
    fighter.classHistory = [...fighter.classHistory, card.class];
    fighter.cardHistory = [...fighter.cardHistory, card.id];
    fighter.damageDealt += outcome.damageDealt;
    fighter.bestHit = Math.max(fighter.bestHit, outcome.damageDealt);

    if (outcome.dodged) fighter.usedOnce = [...new Set<AbilityId>([...fighter.usedOnce, 'afterimage'])];

    // Energy: pay the cost (or nothing when the free-play rescue triggered).
    const payable = canPlay(state.fighters[side], card.id);
    fighter.energy = Math.max(0, fighter.energy - (payable.freePlay ? 0 : card.energyCost));

    // Burn bookkeeping. An existing burn has already ticked inside the combat
    // engine, so here we only expire it. A fresh Ignition starts next round.
    let burn: BurnState | null = fighter.burn ? { ...fighter.burn } : null;
    if (burn) {
      burn.roundsLeft -= 1;
      if (burn.roundsLeft <= 0) burn = null;
    }
    if (outcome.appliedBurn) {
      burn = {
        damage: BALANCE.burnDamage,
        roundsLeft: BALANCE.burnRounds,
        appliedRound: result.round,
        sourceSide: OTHER[side],
        sourceName: cards[OTHER[side]].name,
      };
    }
    fighter.burn = burn;

    fighters[side] = fighter;
  }

  let next: MatchState = {
    ...state,
    fighters,
    lastResult: result,
    phase: 'reveal',
    pending: { p1: null, p2: null },
  };

  next = pushLog(
    next,
    `Round ${result.round}: ${p1Card.name} vs ${p2Card.name} — damage ${result.p1.damageDealt} vs ${result.p2.damageDealt}.`,
    'neutral',
  );

  return next;
}

/** Called by the UI after the reveal animation finishes. */
export function advanceRound(state: MatchState): MatchState {
  if (state.phase !== 'reveal' || !state.lastResult) return state;

  const result = state.lastResult;
  const p1Hp = result.hpAfter.p1;
  const p2Hp = result.hpAfter.p2;

  if (p1Hp <= 0 || p2Hp <= 0 || state.round >= state.maxRounds) {
    let winner: Side | 'draw' | null;
    if (p1Hp <= 0 && p2Hp <= 0) winner = 'draw';
    else if (p1Hp <= 0) winner = 'p2';
    else if (p2Hp <= 0) winner = 'p1';
    else if (p1Hp === p2Hp) winner = 'draw';
    else winner = p1Hp > p2Hp ? 'p1' : 'p2';

    let next: MatchState = { ...state, phase: 'match-end', winner };
    next = pushLog(
      next,
      winner === 'draw'
        ? 'The match ends in a draw.'
        : `${next.fighters[winner].name} wins the match!`,
      winner === 'draw' ? 'neutral' : 'special',
    );
    return next;
  }

  const round = state.round + 1;
  const fighters = { ...state.fighters };
  for (const side of SIDES) {
    const fighter = { ...fighters[side] };
    fighter.energy = Math.min(BALANCE.energyMax, fighter.energy + BALANCE.energyPerRound);
    // Sustain draws: keep a full hand so every round is a real decision.
    while (fighter.hand.length < BALANCE.handSize && fighter.drawPile.length > 0) {
      const nextCard = fighter.drawPile.shift();
      if (nextCard) fighter.hand.push(nextCard);
    }
    fighters[side] = fighter;
  }

  let next: MatchState = {
    ...state,
    round,
    phase: 'p1-select',
    fighters,
    lastResult: result,
  };
  next = pushLog(next, `Round ${round} begins. Energy restored.`, 'neutral');
  return next;
}

/** Local two-player handoff between P1's secret pick and P2's turn. */
export function beginHandoff(state: MatchState): MatchState {
  if (state.phase !== 'p1-select' || !state.pending.p1) return state;
  if (state.mode !== 'local') return state;
  return { ...state, phase: 'handoff' };
}

export function handoffToP2(state: MatchState): MatchState {
  if (state.phase !== 'handoff') return state;
  return { ...state, phase: 'p2-select' };
}

/** AI matches: player 1 picks, then the AI answers instantly. */
export function selectWithAI(state: MatchState, aiCardId: string): MatchState {
  if (state.phase !== 'p1-select' || !state.pending.p1) return state;
  if (state.mode !== 'ai') return state;
  if (!state.fighters.p2.hand.includes(aiCardId)) return state;
  return { ...state, pending: { ...state.pending, p2: aiCardId }, phase: 'p2-select' };
}

/**
 * The view of a match that a given viewer is allowed to see.
 *
 * This is the privacy boundary for simultaneous hidden selection: a viewer
 * can always see their own pending card, and can only see the opponent's once
 * the round has been revealed. The UI must render from this, never from
 * `MatchState.pending` directly.
 */
export interface PublicMatchView {
  state: MatchState;
  /** The viewer's own hidden pick (null before they pick). */
  ownPick: string | null;
  /** The opponent's pick — null until the current round is revealed. */
  opponentPick: string | null;
  /** True when the opponent has confirmed (never reveals which card). */
  opponentReady: boolean;
}

export function publicView(state: MatchState, viewer: Side): PublicMatchView {
  const opponent = OTHER[viewer];
  const revealed = state.phase === 'reveal' || state.phase === 'round-end' || state.phase === 'match-end';
  const result = state.lastResult;

  // Once a round is revealed the picks live in the result, not in `pending`.
  const revealedPick = (side: Side): string | null =>
    revealed && result
      ? side === 'p1'
        ? result.p1.cardId
        : result.p2.cardId
      : null;

  return {
    state,
    ownPick: revealed ? revealedPick(viewer) : state.pending[viewer],
    opponentPick: revealed ? revealedPick(opponent) : null,
    opponentReady: state.pending[opponent] !== null,
  };
}

export function remainingCards(fighter: FighterState): { hand: number; draw: number; used: number } {
  return { hand: fighter.hand.length, draw: fighter.drawPile.length, used: fighter.used.length };
}
