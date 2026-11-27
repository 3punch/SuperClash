import { BALANCE } from './balance';
import { previewClash } from './combat';
import { getHero, requireHero } from './data/heroes';
import { canPlay, makeRng, OTHER } from './engine';
import type { AIDifficulty, FighterState, HeroCard, MatchState, Side } from './types';

/**
 * The AI never sees the opponent's pending card — it reasons only from public
 * state (health, energy, revealed history) exactly like a human could.
 */

export interface AIChoice {
  cardId: string;
  /** Human-readable reason, useful for debugging and for the "A.I. logic" panel. */
  rationale: string;
  score: number;
}

const HISTORY_WINDOW = 3;

function opponentOf(state: MatchState, side: Side): FighterState {
  return state.fighters[OTHER[side]];
}

/** Class frequencies the opponent has shown so far (public information). */
export function classTendency(history: HeroCard[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of history) counts.set(card.class, (counts.get(card.class) ?? 0) + 1);
  return counts;
}

/** Average ATK/DEF of the opponent's revealed cards, weighted to recent picks. */
function observedProfile(history: HeroCard[]): { atk: number; def: number; speed: number; count: number } {
  const recent = history.slice(-HISTORY_WINDOW);
  if (recent.length === 0) return { atk: 5, def: 5, speed: 5, count: 0 };
  let atk = 0;
  let def = 0;
  let speed = 0;
  let weightTotal = 0;
  recent.forEach((card, index) => {
    const weight = index + 1;
    atk += card.attack * weight;
    def += card.defense * weight;
    speed += card.speed * weight;
    weightTotal += weight;
  });
  return {
    atk: atk / weightTotal,
    def: def / weightTotal,
    speed: speed / weightTotal,
    count: recent.length,
  };
}

/** Best damage this card can do against an estimated-average enemy card. */
function offenceScore(card: HeroCard, self: FighterState, profile: ReturnType<typeof observedProfile>): number {
  const stats = getHero(card.id);
  if (!stats) return 0;
  let best = 0;
  for (const [atk, def] of [
    [profile.atk, profile.def],
    [profile.atk + 2, profile.def - 2],
    [Math.max(1, profile.atk - 2), profile.def + 2],
  ]) {
    const fake = { ...stats, attack: Math.round(atk), defense: Math.round(def) } as HeroCard;
    best = Math.max(best, previewClash(stats, fake, self.hp, self.maxHp));
  }
  return best;
}

/** How much punishment this card can absorb from an average enemy card. */
function defenceScore(card: HeroCard, self: FighterState, profile: ReturnType<typeof observedProfile>): number {
  const stats = getHero(card.id);
  if (!stats) return 0;
  const threat = Math.round(profile.atk);
  const fake = { ...stats, attack: threat, defense: Math.round(profile.def) } as HeroCard;
  const incoming = previewClash(fake, stats, profile.atk, self.hp);
  return Math.max(0, 8 - incoming);
}

/**
 * Public entry point. The AI always returns a legal card; if none is
 * affordable the engine's free-play rescue applies to the cheapest card.
 */
export function chooseAICard(state: MatchState, side: Side, difficulty?: AIDifficulty): AIChoice {
  const self = state.fighters[side];
  const opponent = opponentOf(state, side);
  const level = difficulty ?? self.difficulty ?? 'hero';
  const hand = self.hand.map(requireHero).filter(Boolean);

  if (hand.length === 0) {
    return { cardId: '', rationale: 'No cards available.', score: 0 };
  }

  const playable = hand.filter((card) => canPlay(self, card.id).ok);
  const pool = playable.length > 0 ? playable : hand;
  const profile = observedProfile(opponent.cardHistory.map(requireHero).filter(Boolean));
  const rng = makeRng(state.round * 7919 + self.hand.length * 104729 + state.seed);

  const killPossible = self.hp > 0 && opponent.hp <= 12;

  const scored = pool.map((card) => {
    const offence = offenceScore(card, self, profile);
    const defence = defenceScore(card, self, profile);
    const efficiency = offence / Math.max(1, card.energyCost);
    const finisher = offence >= opponent.hp ? 25 : 0;

    let score = offence * 1.0 + defence * 0.9 + efficiency * 1.4 + finisher;

    // ── Ability awareness ────────────────────────────────────────────────
    switch (card.abilityId) {
      case 'bloodrage':
        score += self.hp <= BALANCE.lowHpThreshold ? 5 : -1;
        break;
      case 'lastBastion':
        score += self.hp <= BALANCE.lowHpThreshold ? 5 : 0;
        break;
      case 'aegis':
        score += opponent.hp < self.hp ? 2 : 0;
        break;
      case 'afterimage':
        score += self.usedOnce.includes('afterimage') ? 0 : 4;
        break;
      case 'riposte':
        // Best against opponents who have shown high defence.
        score += profile.def >= 5 ? 3 : 0;
        break;
      case 'refract':
        score += profile.atk >= 6 ? 3 : 0;
        break;
      case 'ignition':
        // Burn is worth more the longer the match has to run.
        score += (state.maxRounds - state.round) >= 1 ? 3 : 0;
        break;
      case 'regrowth':
        score += self.hp <= 12 ? 3 : 0;
        break;
      case 'countermeasures':
        score += classPressure(opponent) ? 4 : 0;
        break;
      case 'precognition':
        score += profile.speed >= 6 ? 3 : 0;
        break;
      case 'frostbind':
        score += opponent.cardHistory.length > 0 ? 2 : 1;
        break;
      case 'crushing':
        score += profile.def >= 5 ? 3 : 0;
        break;
      case 'duelist':
        score += profile.atk >= 6 ? 2 : 0;
        break;
      case 'blinkstrike':
      case 'overcharge':
        score += profile.def >= 6 ? 4 : 1;
        break;
      default:
        break;
    }

    // Legend hunts for lethal and avoids wasting its finisher.
    if (level === 'legend') {
      if (offence >= opponent.hp) score += 20;
      if (opponent.hp <= 6 && card.class !== 'tank') score += 4;
    }
    if (level === 'rookie') {
      score += rng() * 9 - 4; // deliberately noisy
      score -= finisher;
    }
    if (killPossible && level !== 'rookie') score += offence * 0.15;

    return { card, score, offence };
  });

  scored.sort((a, b) => b.score - a.score || a.card.energyCost - b.card.energyCost);

  const rationale = buildRationale(scored[0].card, scored[0].offence, level, self, profile);

  if (level === 'hero' && scored.length > 1 && rng() < 0.18) {
    return {
      cardId: scored[1].card.id,
      rationale: `${rationale} (mixed it up)`,
      score: scored[1].score,
    };
  }

  return { cardId: scored[0].card.id, rationale, score: scored[0].score };
}

/**
 * Sentinel's Countermeasures looks at the class the opponent played last round.
 * By definition that is always the most recent revealed class, so the bonus is
 * live whenever the opponent has any played cards at all.
 */
function classPressure(opponent: FighterState): boolean {
  return opponent.classHistory.length > 0;
}

function buildRationale(
  card: HeroCard,
  offence: number,
  level: AIDifficulty,
  self: FighterState,
  profile: ReturnType<typeof observedProfile>,
): string {
  if (level === 'rookie') return `${card.name} — big numbers, questionable tactics.`;
  const bits: string[] = [];
  if (offence >= 6) bits.push('heavy damage potential');
  if (self.hp <= BALANCE.lowHpThreshold && (card.abilityId === 'bloodrage' || card.abilityId === 'lastBastion')) {
    bits.push('ideal while wounded');
  }
  if (profile.count > 0 && profile.def >= 6 && card.abilityId === 'blinkstrike') {
    bits.push('punishes armour');
  }
  if (bits.length === 0) bits.push('best expected trade');
  return `${card.name} — ${bits.join(', ')}.`;
}

/** Which card the AI would play, useful for UI previews and tests. */
export function predictAIPick(state: MatchState, difficulty?: AIDifficulty): string {
  return chooseAICard(state, 'p2', difficulty).cardId;
}
