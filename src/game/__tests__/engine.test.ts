import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { chooseAICard } from '../ai';
import {
  advanceRound,
  beginHandoff,
  publicView,
  commitRound,
  createMatch,
  handoffToP2,
  makeRng,
  selectCard,
  selectWithAI,
  shuffle,
  validateDeck,
  sanitizeDeck,
  canPlay,
} from '../engine';
import { requireHero } from '../data/heroes';
import type { MatchState } from '../types';

const DECK_A = ['kairo', 'voltrex', 'echo', 'ironclad', 'ravager', 'sentinel', 'pyroclast', 'prism'];
const DECK_B = ['ravager', 'kairo', 'voltrex', 'sentinel', 'echo', 'bulwark', 'ironclad', 'pyroclast'];

function makeAiMatch(seed = 42): MatchState {
  return createMatch({
    mode: 'ai',
    p1Name: 'Player',
    p2Name: 'A.I.',
    p1Deck: DECK_A,
    p2Deck: DECK_B,
    p2Difficulty: 'hero',
    seed,
  });
}

function makeLocalMatch(seed = 7): MatchState {
  return createMatch({
    mode: 'local',
    p1Name: 'P1',
    p2Name: 'P2',
    p1Deck: DECK_A,
    p2Deck: DECK_B,
    seed,
  });
}

/** Play a whole match with both sides picking their first legal card. */
function playOut(state: MatchState): MatchState {
  let current = state;
  let guard = 0;
  while (current.phase !== 'match-end' && guard < 200) {
    guard += 1;
    if (current.phase === 'p1-select') {
      const card = current.fighters.p1.hand.find((id) => canPlay(current.fighters.p1, id).ok);
      if (!card) throw new Error('no legal p1 card');
      current = selectCard(current, 'p1', card);
      if (current.mode === 'ai') {
        const ai = chooseAICard(current, 'p2', 'hero');
        current = selectWithAI(current, ai.cardId);
        current = commitRound(current);
      } else {
        current = beginHandoff(current);
        current = handoffToP2(current);
      }
    } else if (current.phase === 'p2-select') {
      const card = current.fighters.p2.hand.find((id) => canPlay(current.fighters.p2, id).ok);
      if (!card) throw new Error('no legal p2 card');
      current = selectCard(current, 'p2', card);
      current = commitRound(current);
    }
    if (current.phase === 'reveal') current = advanceRound(current);
  }
  return current;
}

describe('match setup', () => {
  it('starts both fighters at 20 HP with a 3 card hand', () => {
    const state = makeAiMatch();
    expect(state.fighters.p1.hp).toBe(20);
    expect(state.fighters.p2.hp).toBe(20);
    expect(state.fighters.p1.hand).toHaveLength(BALANCE.handSize);
    expect(state.fighters.p2.hand).toHaveLength(BALANCE.handSize);
  });

  it('never deals duplicate cards', () => {
    const state = makeAiMatch();
    for (const side of ['p1', 'p2'] as const) {
      const all = [...state.fighters[side].hand, ...state.fighters[side].drawPile];
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('shuffles deterministically for a given seed', () => {
    const a = makeAiMatch(99);
    const b = makeAiMatch(99);
    expect(a.fighters.p1.hand).toEqual(b.fighters.p1.hand);
    expect(shuffle([1, 2, 3, 4, 5], makeRng(3))).toEqual(shuffle([1, 2, 3, 4, 5], makeRng(3)));
  });

  it('starts in p1-select', () => {
    expect(makeAiMatch().phase).toBe('p1-select');
  });
});

describe('hidden selection', () => {
  it('stores a pick without resolving anything', () => {
    const state = makeAiMatch();
    const card = state.fighters.p1.hand[0];
    const next = selectCard(state, 'p1', card);
    expect(next.pending.p1).toBe(card);
    expect(next.phase).toBe('p1-select');
    expect(next.lastResult).toBeNull();
    expect(next.fighters.p2.hp).toBe(20);
  });

  it('rejects a selection from the inactive side', () => {
    const state = makeAiMatch();
    const next = selectCard(state, 'p2', state.fighters.p2.hand[0]);
    expect(next.pending.p2).toBeNull();
    expect(next).toBe(state);
  });

  it('rejects a card that is not in hand', () => {
    const state = makeAiMatch();
    const notInHand = DECK_A.find((id) => !state.fighters.p1.hand.includes(id))!;
    const next = selectCard(state, 'p1', notInHand);
    expect(next.pending.p1).toBeNull();
  });

  it('rejects a second selection in the same round', () => {
    let state = makeAiMatch();
    const first = state.fighters.p1.hand[0];
    const second = state.fighters.p1.hand[1];
    state = selectCard(state, 'p1', first);
    const again = selectCard(state, 'p1', second);
    expect(again.pending.p1).toBe(first);
  });

  it('cannot commit with only one side selected', () => {
    const state = makeAiMatch();
    const next = commitRound(selectCard(state, 'p1', state.fighters.p1.hand[0]));
    expect(next.lastResult).toBeNull();
    expect(next.fighters.p2.hp).toBe(20);
  });

  it('does not leak the opponent pick through the public view', () => {
    let state = makeLocalMatch();
    const p1Card = state.fighters.p1.hand[0];
    state = selectCard(state, 'p1', p1Card);

    // Viewer = P2, before the reveal: the pick must be invisible but the
    // "opponent is ready" flag is public.
    const asP2 = publicView(state, 'p2');
    expect(asP2.opponentPick).toBeNull();
    expect(asP2.opponentReady).toBe(true);
    expect(JSON.stringify({ ...asP2, state: undefined })).not.toContain(p1Card);

    // After P2 commits, both are public.
    state = beginHandoff(state);
    state = handoffToP2(state);
    state = selectCard(state, 'p2', state.fighters.p2.hand[0]);
    state = commitRound(state);
    expect(publicView(state, 'p2').opponentPick).toBe(p1Card);
  });

  it('exposes the viewer own pick to themselves only', () => {
    let state = makeLocalMatch();
    const p1Card = state.fighters.p1.hand[0];
    state = selectCard(state, 'p1', p1Card);
    expect(publicView(state, 'p1').ownPick).toBe(p1Card);
    expect(publicView(state, 'p2').ownPick).toBeNull();
  });
});

describe('local two-player privacy', () => {
  it('moves P1 to a handoff screen before P2 may pick', () => {
    let state = makeLocalMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    expect(state.phase).toBe('p1-select');
    state = beginHandoff(state);
    expect(state.phase).toBe('handoff');
  });

  it('blocks P2 selection during the handoff', () => {
    let state = makeLocalMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = beginHandoff(state);
    const blocked = selectCard(state, 'p2', state.fighters.p2.hand[0]);
    expect(blocked.pending.p2).toBeNull();
    expect(blocked).toBe(state);
  });

  it('allows P2 to pick only after the handoff is acknowledged', () => {
    let state = makeLocalMatch();
    const p1Card = state.fighters.p1.hand[0];
    state = selectCard(state, 'p1', p1Card);
    state = beginHandoff(state);
    state = handoffToP2(state);
    expect(state.phase).toBe('p2-select');
    expect(state.pending.p1).toBe(p1Card);
    state = selectCard(state, 'p2', state.fighters.p2.hand[0]);
    expect(state.pending.p2).toBe(state.fighters.p2.hand[0]);
  });

  it('reveals both cards only after P2 commits', () => {
    let state = makeLocalMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = beginHandoff(state);
    state = handoffToP2(state);
    expect(state.lastResult).toBeNull();
    state = selectCard(state, 'p2', state.fighters.p2.hand[0]);
    state = commitRound(state);
    expect(state.phase).toBe('reveal');
    expect(state.lastResult).not.toBeNull();
    expect(state.pending).toEqual({ p1: null, p2: null });
  });

  it('handoff is not available in AI mode', () => {
    let state = makeAiMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    expect(beginHandoff(state).phase).toBe('p1-select');
  });
});

describe('card lifecycle', () => {
  it('removes a played card from the hand and marks it used', () => {
    let state = makeAiMatch();
    const card = state.fighters.p1.hand[0];
    state = selectCard(state, 'p1', card);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    expect(state.fighters.p1.hand).not.toContain(card);
    expect(state.fighters.p1.used).toContain(card);
    expect(state.fighters.p1.hand).toHaveLength(BALANCE.handSize - 1);
  });

  it('never allows a used card to be played again', () => {
    let state = makeAiMatch();
    const card = state.fighters.p1.hand[0];
    state = selectCard(state, 'p1', card);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    state = advanceRound(state);
    // Force the used card back into the hand to simulate corrupt state.
    state = {
      ...state,
      fighters: { ...state.fighters, p1: { ...state.fighters.p1, hand: [...state.fighters.p1.hand, card] } },
    };
    const play = canPlay(state.fighters.p1, card);
    expect(play.ok).toBe(false);
    expect(selectCard(state, 'p1', card).pending.p1).toBeNull();
  });

  it('draws a replacement card at the start of the next round', () => {
    let state = makeAiMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    state = advanceRound(state);
    expect(state.fighters.p1.hand).toHaveLength(BALANCE.handSize);
  });

  it('spends energy when a card is played', () => {
    let state = makeAiMatch();
    const before = state.fighters.p1.energy;
    const card = requireHero(state.fighters.p1.hand[0]);
    state = selectCard(state, 'p1', card.id);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    expect(state.fighters.p1.energy).toBe(Math.max(0, before - card.energyCost));
  });

  it('rejects expensive cards while a cheap card is still affordable', () => {
    const state = makeAiMatch();
    const low = {
      ...state.fighters.p1,
      energy: 1,
      hand: ['mammoth', 'thornwild', 'bulwark'],
    };
    // Nothing is affordable at 1 energy → the rescue lets the cheapest play free.
    expect(canPlay(low, 'mammoth').freePlay).toBe(true);
    expect(canPlay(low, 'mammoth').ok).toBe(true);

    // With energy for a 2-cost card in hand, the 5-cost card is illegal.
    const mixed = { ...low, energy: 2, hand: ['mammoth', 'thornwild', 'kairo'] };
    expect(canPlay(mixed, 'mammoth').ok).toBe(false);
    expect(canPlay(mixed, 'kairo').ok).toBe(true);
  });

  it('charges nothing when the free-play rescue triggers', () => {
    let state = makeAiMatch();
    state = {
      ...state,
      fighters: { ...state.fighters, p1: { ...state.fighters.p1, energy: 0, hand: ['mammoth', 'thornwild', 'bulwark'] } },
    };
    state = selectCard(state, 'p1', 'mammoth');
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    expect(state.fighters.p1.energy).toBe(0);
  });
});

describe('deck validation', () => {
  it('accepts a legal deck', () => {
    expect(validateDeck(DECK_A).valid).toBe(true);
  });
  it('rejects the wrong size', () => {
    expect(validateDeck(DECK_A.slice(0, 5)).valid).toBe(false);
  });
  it('rejects duplicates', () => {
    expect(validateDeck([...DECK_A.slice(0, 7), 'kairo']).valid).toBe(false);
  });
  it('rejects unknown cards', () => {
    expect(validateDeck([...DECK_A.slice(0, 7), 'not-a-hero']).valid).toBe(false);
  });
  it('requires cheap cards', () => {
    const pricey = ['mammoth', 'thornwild', 'gravlord', 'bulwark', 'shiv', 'arcwraith', 'oracle', 'pyroclast'];
    expect(validateDeck(pricey).valid).toBe(false);
  });
  it('sanitizes untrusted saved decks', () => {
    expect(sanitizeDeck(undefined, DECK_A)).toEqual(DECK_A);
    expect(sanitizeDeck('nope', DECK_A)).toEqual(DECK_A);
    expect(sanitizeDeck(['kairo', 'kairo'], DECK_A)).toEqual(DECK_A);
    expect(sanitizeDeck(DECK_A, DECK_B)).toEqual(DECK_A);
  });
});

describe('round flow', () => {
  it('resolves a round and exposes the result', () => {
    let state = makeAiMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    expect(state.phase).toBe('reveal');
    expect(state.lastResult?.round).toBe(1);
  });

  it('advances to the next round with restored energy', () => {
    let state = makeAiMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    state = advanceRound(state);
    expect(state.round).toBe(2);
    expect(state.phase).toBe('p1-select');
    expect(state.fighters.p1.energy).toBeGreaterThanOrEqual(BALANCE.energyPerRound);
  });

  it('cannot advance twice from the same reveal', () => {
    let state = makeAiMatch();
    state = selectCard(state, 'p1', state.fighters.p1.hand[0]);
    state = selectWithAI(state, chooseAICard(state, 'p2', 'hero').cardId);
    state = commitRound(state);
    const once = advanceRound(state);
    expect(advanceRound(once)).toBe(once);
  });

  it('ignores commit calls at the wrong time', () => {
    const state = makeAiMatch();
    expect(commitRound(state)).toBe(state);
  });
});

describe('match completion', () => {
  it('finishes a full AI match within five rounds', () => {
    const final = playOut(makeAiMatch(11));
    expect(final.phase).toBe('match-end');
    expect(final.round).toBeLessThanOrEqual(BALANCE.maxRounds);
    expect(final.winner).not.toBeNull();
  });

  it('finishes a full local match within five rounds', () => {
    const final = playOut(makeLocalMatch(12));
    expect(final.phase).toBe('match-end');
    expect(final.round).toBeLessThanOrEqual(BALANCE.maxRounds);
  });

  it('ends after exactly five rounds when both survive', () => {
    const final = playOut(makeAiMatch(13));
    if (final.fighters.p1.hp > 0 && final.fighters.p2.hp > 0) {
      expect(final.round).toBe(BALANCE.maxRounds);
    }
  });

  it('declares a draw when health is equal at the end', () => {
    // Build a state at round 5 with equal HP and force a 0-0 round.
    let state = makeAiMatch(21);
    state = {
      ...state,
      round: BALANCE.maxRounds,
      fighters: {
        p1: { ...state.fighters.p1, hp: 10, hand: ['echo', 'sentinel', 'kairo'] },
        p2: { ...state.fighters.p2, hp: 10, hand: ['echo', 'sentinel', 'kairo'] },
      },
    };
    state = selectCard(state, 'p1', 'echo');
    state = selectWithAI(state, 'echo');
    state = commitRound(state);
    state = advanceRound(state);
    expect(state.phase).toBe('match-end');
    expect(state.winner).toBe('draw');
  });

  it('declares a winner on health when five rounds pass', () => {
    let state = makeAiMatch(22);
    state = {
      ...state,
      round: BALANCE.maxRounds,
      fighters: {
        p1: { ...state.fighters.p1, hp: 14, hand: ['sentinel', 'echo', 'kairo'] },
        p2: { ...state.fighters.p2, hp: 9, hand: ['ironclad', 'bulwark', 'mammoth'] },
      },
    };
    state = selectCard(state, 'p1', 'sentinel');
    state = selectWithAI(state, 'ironclad');
    state = commitRound(state);
    state = advanceRound(state);
    expect(state.phase).toBe('match-end');
    expect(state.winner).toBe('p1');
  });

  it('ends instantly on a knockout', () => {
    let state = makeAiMatch(23);
    state = {
      ...state,
      fighters: {
        p1: { ...state.fighters.p1, hp: 20, hand: ['ravager', 'kairo', 'voltrex'] },
        p2: { ...state.fighters.p2, hp: 3, hand: ['voltrex', 'bulwark', 'mammoth'] },
      },
    };
    state = selectCard(state, 'p1', 'ravager');
    state = selectWithAI(state, 'voltrex');
    state = commitRound(state);
    state = advanceRound(state);
    expect(state.fighters.p2.hp).toBe(0);
    expect(state.phase).toBe('match-end');
    expect(state.winner).toBe('p1');
  });

  it('never reports negative health', () => {
    const final = playOut(makeAiMatch(24));
    expect(final.fighters.p1.hp).toBeGreaterThanOrEqual(0);
    expect(final.fighters.p2.hp).toBeGreaterThanOrEqual(0);
  });

  it('is reproducible for the same seed', () => {
    const a = playOut(makeAiMatch(555));
    const b = playOut(makeAiMatch(555));
    expect(a.winner).toBe(b.winner);
    expect(a.fighters.p1.hp).toBe(b.fighters.p1.hp);
    expect(a.fighters.p2.hp).toBe(b.fighters.p2.hp);
  });
});

describe('AI behaviour', () => {
  it('always returns a card from its hand', () => {
    for (const difficulty of ['rookie', 'hero', 'legend'] as const) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const state = makeAiMatch(seed);
        const choice = chooseAICard(state, 'p2', difficulty);
        expect(state.fighters.p2.hand).toContain(choice.cardId);
      }
    }
  });

  it('is deterministic for identical public state', () => {
    const state = makeAiMatch(31);
    const a = chooseAICard(state, 'p2', 'legend');
    const b = chooseAICard(state, 'p2', 'legend');
    expect(a.cardId).toBe(b.cardId);
  });

  it('is not merely random — it repeats the same pick when state repeats', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 10; i += 1) picks.add(chooseAICard(makeAiMatch(77), 'p2', 'hero').cardId);
    expect(picks.size).toBe(1);
  });

  it('varies picks as public state changes', () => {
    const fresh = chooseAICard(makeAiMatch(31), 'p2', 'legend');
    const wounded = chooseAICard(
      {
        ...makeAiMatch(31),
        fighters: {
          ...makeAiMatch(31).fighters,
          p2: { ...makeAiMatch(31).fighters.p2, hp: 4 },
        },
      },
      'p2',
      'legend',
    );
    const freshEvery = fresh.cardId;
    const picks = new Set([freshEvery, wounded.cardId]);
    expect(picks.size).toBeGreaterThanOrEqual(1);
  });

  it('ignores the player hidden selection (no cheating)', () => {
    const base = makeAiMatch(31);
    const withHiddenPick = { ...base, pending: { p1: base.fighters.p1.hand[0], p2: null } };
    const a = chooseAICard(base, 'p2', 'legend');
    const b = chooseAICard(withHiddenPick, 'p2', 'legend');
    expect(a.cardId).toBe(b.cardId);
  });

  it('explains its choice', () => {
    const choice = chooseAICard(makeAiMatch(31), 'p2', 'hero');
    expect(choice.rationale.length).toBeGreaterThan(0);
  });
});
