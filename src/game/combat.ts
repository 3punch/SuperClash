import { BALANCE } from './balance';
import { ABILITIES } from './data/abilities';
import type {
  AbilityId,
  BonusLine,
  CombatEvent,
  FighterSnapshot,
  HeroCard,
  RoundBeat,
  RoundInput,
  RoundResult,
  Side,
  SideOutcome,
} from './types';

const OTHER: Record<Side, Side> = { p1: 'p2', p2: 'p1' };
const SIDES: Side[] = ['p1', 'p2'];

/** Mutable per-side scratchpad used while resolving a single clash. */
interface Working {
  side: Side;
  card: HeroCard;
  fighter: FighterSnapshot;
  atk: BonusLine[];
  def: BonusLine[];
  speed: number;
  /** Blink Strike: ignore the opposing card's DEF for this clash. */
  piercesDefense: boolean;
  /** Precognition: cancel the opponent's initiative bonus. */
  deniesOpponentInitiative: boolean;
  /** Zephyra's dodge is still unused for the match. */
  afterimageAvailable: boolean;
  dodged: boolean;
  attackBlocked: boolean;
  appliedBurn: boolean;

  clashDealt: number;
  arcDealt: number;
  reflectDealt: number;
  riposteDealt: number;
  burnDealt: number;
  healed: number;

  tookClash: number;
  tookArc: number;
  tookReflect: number;
  tookRiposte: number;
  tookBurn: number;

  events: CombatEvent[];
  notes: string[];
}

function makeWorking(side: Side, card: HeroCard, fighter: FighterSnapshot): Working {
  return {
    side,
    card,
    fighter,
    atk: [],
    def: [],
    speed: card.speed,
    piercesDefense: false,
    deniesOpponentInitiative: false,
    afterimageAvailable:
      card.abilityId === 'afterimage' && !fighter.usedOnce.includes('afterimage'),
    dodged: false,
    attackBlocked: false,
    appliedBurn: false,
    clashDealt: 0,
    arcDealt: 0,
    reflectDealt: 0,
    riposteDealt: 0,
    burnDealt: 0,
    healed: 0,
    tookClash: 0,
    tookArc: 0,
    tookReflect: 0,
    tookRiposte: 0,
    tookBurn: 0,
    events: [],
    notes: [],
  };
}

function has(w: Working, id: AbilityId): boolean {
  return w.card.abilityId === id;
}

function addBonus(lines: BonusLine[], label: string, value: number): void {
  if (value === 0) return;
  lines.push({ label, value });
}

function bonusSum(lines: BonusLine[]): number {
  return lines.reduce((total, line) => total + line.value, 0);
}

function clampHp(hp: number, maxHp: number): number {
  return Math.max(0, Math.min(maxHp, hp));
}

function totalTaken(w: Working): number {
  return w.tookClash + w.tookArc + w.tookReflect + w.tookRiposte + w.tookBurn;
}

function totalDealt(w: Working): number {
  return w.clashDealt + w.arcDealt + w.reflectDealt + w.riposteDealt + w.burnDealt;
}

/**
 * Resolve one simultaneous clash.
 *
 * Fixed order of operations:
 *   1. Both cards are already revealed by the caller.
 *   2. Passive abilities.
 *   3. Speed / initiative.
 *   4. Special & conditional ability bonuses.
 *   5. Attack and defence totals.
 *   6. Damage.
 *   7. Reactive abilities (reflect / riposte).
 *   8. Status effects (burn ticks, regrowth).
 *   9. Health clamp and knockouts.
 *
 * Pure and symmetric: inputs are never mutated, and every calculation uses
 * pre-clash state, so side order cannot bias the result.
 */
export function resolveRound(input: RoundInput): RoundResult {
  const { round, cards, fighters } = input;

  const work: Record<Side, Working> = {
    p1: makeWorking('p1', cards.p1, fighters.p1),
    p2: makeWorking('p2', cards.p2, fighters.p2),
  };
  const foe = (side: Side): Working => work[OTHER[side]];

  // ── 2. Passives ─────────────────────────────────────────────────────────
  for (const side of SIDES) {
    const self = work[side];
    const low = self.fighter.hp <= BALANCE.lowHpThreshold;
    if (has(self, 'lastBastion') && low) {
      addBonus(self.def, 'Last Bastion', BALANCE.lastBastionDefense);
      self.events.push({ type: 'ability', side, abilityId: 'lastBastion', label: ABILITIES.lastBastion.shout });
    }
    if (has(self, 'bloodrage') && low) {
      addBonus(self.atk, 'Bloodrage', BALANCE.bloodrageAttack);
      self.events.push({ type: 'ability', side, abilityId: 'bloodrage', label: ABILITIES.bloodrage.shout });
    }
  }

  // ── 3. Speed effects ────────────────────────────────────────────────────
  for (const side of SIDES) {
    const self = work[side];
    if (has(self, 'frostbind')) {
      const target = foe(side);
      target.speed -= BALANCE.frostbindSpeed;
      self.events.push({ type: 'ability', side, abilityId: 'frostbind', label: ABILITIES.frostbind.shout });
      self.notes.push(`${self.card.name}'s Frostbind slowed ${target.card.name} by ${BALANCE.frostbindSpeed} SPD.`);
    }
    if (has(self, 'precognition')) {
      self.deniesOpponentInitiative = true;
      addBonus(self.def, 'Precognition', BALANCE.precognitionDefense);
    }
  }

  const speedEdge: Record<Side, number> = {
    p1: work.p1.speed - work.p2.speed,
    p2: work.p2.speed - work.p1.speed,
  };
  const initiative: Record<Side, boolean> = { p1: false, p2: false };
  for (const side of SIDES) {
    const self = work[side];
    if (speedEdge[side] >= BALANCE.speedEdgeThreshold && !foe(side).deniesOpponentInitiative) {
      initiative[side] = true;
      addBonus(self.atk, 'Initiative', BALANCE.speedBonus);
      self.events.push({ type: 'speed', side, label: 'SPEED ADVANTAGE' });
      self.notes.push(`${self.card.name} won the speed clash (+${BALANCE.speedBonus} ATK).`);
    }
  }

  // ── 4. Special / conditional bonuses ────────────────────────────────────
  for (const side of SIDES) {
    const self = work[side];
    const target = foe(side);
    switch (self.card.abilityId) {
      case 'duelist':
        if (target.card.attack > self.card.attack) {
          addBonus(self.atk, 'Duelist’s Pride', BALANCE.duelistAttack);
          self.events.push({ type: 'ability', side, abilityId: 'duelist', label: ABILITIES.duelist.shout });
        }
        break;
      case 'crushing': {
        const bonus = Math.floor(target.card.defense / BALANCE.crushingDivisor);
        if (bonus > 0) {
          addBonus(self.atk, 'Crushing Gravity', bonus);
          self.events.push({ type: 'ability', side, abilityId: 'crushing', label: ABILITIES.crushing.shout });
        }
        break;
      }
      case 'countermeasures': {
        const history = target.fighter.classHistory;
        const previous = history.length > 0 ? history[history.length - 1] : null;
        if (previous && previous === target.card.class) {
          addBonus(self.atk, 'Countermeasures', BALANCE.countermeasuresAttack);
          self.events.push({ type: 'ability', side, abilityId: 'countermeasures', label: ABILITIES.countermeasures.shout });
        }
        break;
      }
      case 'blinkstrike':
        self.piercesDefense = true;
        self.events.push({ type: 'ability', side, abilityId: 'blinkstrike', label: ABILITIES.blinkstrike.shout });
        break;
      case 'overcharge':
        self.arcDealt = BALANCE.overchargeDamage;
        self.events.push({ type: 'ability', side, abilityId: 'overcharge', label: ABILITIES.overcharge.shout });
        break;
      default:
        break;
    }
  }

  // ── 5. Attack / defence totals ──────────────────────────────────────────
  const attack: Record<Side, number> = { p1: 0, p2: 0 };
  const defense: Record<Side, number> = { p1: 0, p2: 0 };
  for (const side of SIDES) {
    const self = work[side];
    attack[side] = self.card.attack + bonusSum(self.atk);
    defense[side] = self.card.defense + bonusSum(self.def);
  }
  // Blink Strike pierces the defender's guard, so a side's effective defence
  // is zero when the *opposing* card pierces.
  const effectiveDefense: Record<Side, number> = {
    p1: work.p2.piercesDefense ? 0 : defense.p1,
    p2: work.p1.piercesDefense ? 0 : defense.p2,
  };

  const hp: Record<Side, number> = {
    p1: clampHp(fighters.p1.hp, fighters.p1.maxHp),
    p2: clampHp(fighters.p2.hp, fighters.p2.maxHp),
  };
  const hpBefore: Record<Side, number> = { ...hp };

  // ── 6. Damage (simultaneous) ────────────────────────────────────────────
  for (const side of SIDES) {
    const self = work[side];
    const target = foe(side);
    const incoming = Math.max(0, attack[side] - effectiveDefense[target.side]);

    if (incoming <= 0) {
      self.attackBlocked = true;
      target.events.push({ type: 'block', side: target.side, label: 'BLOCKED' });
      self.notes.push(`${target.card.name}'s guard held — ${self.card.name} never broke through.`);
      continue;
    }

    // Afterimage — a defined once-per-match evade, never random.
    if (
      target.afterimageAvailable &&
      (incoming >= BALANCE.dodgeMinDamage || target.fighter.hp <= BALANCE.dodgeDangerHp)
    ) {
      self.attackBlocked = true;
      target.dodged = true;
      target.afterimageAvailable = false;
      target.events.push({ type: 'dodge', side: target.side, label: ABILITIES.afterimage.shout });
      self.notes.push(`${target.card.name} blinked clean out of ${self.card.name}'s strike — no damage.`);
      continue;
    }

    // Aegis — flat absorption, but a connecting blow still chips through.
    let through = incoming;
    if (has(target, 'aegis')) {
      const absorbed = Math.min(BALANCE.aegisReduction, through - 1);
      if (absorbed > 0) {
        through -= absorbed;
        target.events.push({ type: 'ability', side: target.side, abilityId: 'aegis', label: `AEGIS −${absorbed}` });
        self.notes.push(`${target.card.name}'s Aegis Plating absorbed ${absorbed} damage.`);
      }
    }

    self.clashDealt = through;
    target.tookClash += through;
    hp[target.side] -= through;
    target.events.push({ type: 'attack', side: self.side, amount: through, label: 'HIT' });
    self.notes.push(`${self.card.name} struck ${target.card.name} for ${through}.`);
  }

  // Overcharge arc — unavoidable, ignores DEF and Aegis; a full dodge still evades it.
  for (const side of SIDES) {
    const self = work[side];
    const target = foe(side);
    if (self.arcDealt > 0) {
      if (target.dodged) {
        self.arcDealt = 0;
      } else {
        target.tookArc += self.arcDealt;
        hp[target.side] -= self.arcDealt;
        self.events.push({ type: 'attack', side, amount: self.arcDealt, label: 'ARC' });
        self.notes.push(`${self.card.name}'s Overcharge arced for ${self.arcDealt} unavoidable damage.`);
      }
    }
  }

  // ── 7. Reactive abilities, resolved from the same clash state ───────────
  for (const side of SIDES) {
    const self = work[side];
    const target = foe(side);
    if (has(self, 'refract') && target.clashDealt > 0) {
      self.reflectDealt = BALANCE.refractDamage;
      target.tookReflect += self.reflectDealt;
      hp[target.side] -= self.reflectDealt;
      self.events.push({ type: 'reflect', side, amount: self.reflectDealt, label: ABILITIES.refract.shout });
      self.notes.push(`${self.card.name} refracted ${self.reflectDealt} damage back at ${target.card.name}.`);
    }
    if (has(self, 'riposte') && target.clashDealt === 0 && target.arcDealt === 0) {
      self.riposteDealt = BALANCE.riposteDamage;
      target.tookRiposte += self.riposteDealt;
      hp[target.side] -= self.riposteDealt;
      self.events.push({ type: 'riposte', side, amount: self.riposteDealt, label: ABILITIES.riposte.shout });
      self.notes.push(`${self.card.name} riposted through the guard for ${self.riposteDealt}.`);
    }
  }

  // ── 8. Status effects ───────────────────────────────────────────────────
  // Fresh burns start next round, so they always tick the stated number of times.
  for (const side of SIDES) {
    const self = work[side];
    const target = foe(side);
    if (has(self, 'ignition') && !target.dodged) {
      self.appliedBurn = true;
      self.events.push({ type: 'ability', side, abilityId: 'ignition', label: ABILITIES.ignition.shout });
      self.notes.push(`${target.card.name} is set burning — ${BALANCE.burnDamage}/round for ${BALANCE.burnRounds} rounds.`);
    }
  }

  // Existing burns tick now, never twice in the same round.
  for (const side of SIDES) {
    const fighter = fighters[side];
    const burn = fighter.burn;
    if (!burn || burn.roundsLeft <= 0 || burn.appliedRound >= round) continue;
    const tick = Math.min(burn.damage, Math.max(0, hp[side]));
    if (tick <= 0) continue;
    hp[side] -= tick;
    work[side].tookBurn += tick;
    work[burn.sourceSide].burnDealt += tick;
    work[side].notes.push(`${burn.sourceName}'s fire burned ${fighter.name} for ${tick}.`);
    work[side].events.push({ type: 'burn', side, amount: tick, label: 'BURN' });
  }

  // Regrowth — heals only when this fighter actually took damage.
  for (const side of SIDES) {
    const self = work[side];
    if (!has(self, 'regrowth')) continue;
    if (totalTaken(self) > 0 && hp[side] > 0 && hp[side] < fighters[side].maxHp) {
      const heal = Math.min(BALANCE.regrowthHeal, fighters[side].maxHp - hp[side]);
      hp[side] += heal;
      self.healed = heal;
      self.events.push({ type: 'heal', side, amount: heal, label: ABILITIES.regrowth.shout });
      self.notes.push(`${self.card.name} regrew ${heal} HP.`);
    }
  }

  // ── 9. Health clamp + knockouts ─────────────────────────────────────────
  for (const side of SIDES) {
    hp[side] = clampHp(hp[side], fighters[side].maxHp);
    if (hp[side] === 0) {
      work[side].events.push({ type: 'ko', side, label: 'K.O.' });
      work[side].notes.push(`${work[side].card.name} is knocked out.`);
    }
  }

  // ── Outcomes ────────────────────────────────────────────────────────────
  const outcomes = {} as Record<Side, SideOutcome>;
  for (const side of SIDES) {
    const self = work[side];
    outcomes[side] = {
      side,
      cardId: self.card.id,
      cardName: self.card.name,
      attackBase: self.card.attack,
      attackBonuses: self.atk,
      effectiveAttack: attack[side],
      defenseBase: self.card.defense,
      defenseBonuses: self.def,
      effectiveDefense: effectiveDefense[side],
      speed: self.speed,
      speedEdge: speedEdge[side],
      speedBonus: initiative[side] ? BALANCE.speedBonus : 0,
      clashDamage: self.clashDealt,
      damageDealt: totalDealt(self),
      damageTaken: totalTaken(self) - self.healed,
      blocked: self.attackBlocked,
      dodged: self.dodged,
      healed: self.healed,
      burned: self.tookBurn,
      appliedBurn: self.appliedBurn,
      events: self.events,
      notes: self.notes,
    };
  }

  const winnerSide: Side | null =
    outcomes.p1.damageDealt === outcomes.p2.damageDealt
      ? null
      : outcomes.p1.damageDealt > outcomes.p2.damageDealt
        ? 'p1'
        : 'p2';

  const beats = buildBeats(outcomes);

  return {
    round,
    p1: outcomes.p1,
    p2: outcomes.p2,
    hpBefore,
    hpAfter: { p1: hp.p1, p2: hp.p2 },
    events: [...outcomes.p1.events, ...outcomes.p2.events],
    explanation: buildExplanation(outcomes, winnerSide),
    roundWinner: winnerSide,
    beats,
    headline: buildHeadline(outcomes, winnerSide),
  };
}

/** Ordered presentation beats: abilities → evasions → guards → impacts →
 *  reactions → status → knockouts. The UI plays these one at a time. */
function buildBeats(outcomes: Record<Side, SideOutcome>): RoundBeat[] {
  const beats: RoundBeat[] = [];
  let counter = 0;
  const push = (beat: Omit<RoundBeat, 'id'>) => {
    counter += 1;
    beats.push({ ...beat, id: `beat-${counter}` });
  };

  for (const side of SIDES) {
    const outcome = outcomes[side];
    for (const event of outcome.events) {
      switch (event.type) {
        case 'ability':
          push({ kind: 'ability', side: event.side, label: event.label, amount: 0, abilityId: event.abilityId });
          break;
        case 'speed':
          push({ kind: 'ability', side: event.side, label: 'SPEED ADVANTAGE', amount: 0 });
          break;
        case 'dodge':
          push({ kind: 'dodge', side: event.side, label: event.label, amount: 0, abilityId: 'afterimage' });
          break;
        case 'block':
          push({ kind: 'block', side: event.side, label: 'BLOCKED', amount: 0 });
          break;
        case 'reflect':
          push({ kind: 'reflect', side: event.side, label: event.label, amount: event.amount, abilityId: 'refract' });
          break;
        case 'riposte':
          push({ kind: 'riposte', side: event.side, label: event.label, amount: event.amount, abilityId: 'riposte' });
          break;
        case 'burn':
          push({ kind: 'burn', side: event.side, label: 'BURN', amount: event.amount });
          break;
        case 'heal':
          push({ kind: 'heal', side: event.side, label: event.label, amount: event.amount, abilityId: 'regrowth' });
          break;
        case 'ko':
          push({ kind: 'ko', side: event.side, label: 'K.O.', amount: 0 });
          break;
        default:
          break;
      }
    }
  }
  return beats;
}

function buildHeadline(outcomes: Record<Side, SideOutcome>, winnerSide: Side | null): string {
  if (winnerSide === null) return 'DEAD EVEN';
  const winner = outcomes[winnerSide];
  if (winner.clashDamage === 0) return `${winner.cardName.toUpperCase()} HOLDS THE LINE`;
  return `${winner.cardName.toUpperCase()} BREAKS THROUGH`;
}

function buildExplanation(outcomes: Record<Side, SideOutcome>, winnerSide: Side | null): string[] {
  const lines = [...outcomes.p1.notes, ...outcomes.p2.notes];
  if (winnerSide === null) {
    lines.push('Dead even — neither fighter gained ground.');
    return lines;
  }
  const winner = outcomes[winnerSide];
  const loser = outcomes[winnerSide === 'p1' ? 'p2' : 'p1'];
  lines.push(
    `${winner.cardName} won the exchange, out-damaging ${loser.cardName} ${winner.damageDealt}–${loser.damageDealt}.`,
  );
  return lines;
}

/**
 * Expected damage if `attacker`'s card clashes with `defender`'s card.
 * Used by the AI heuristics and by the UI's "threat" readout. Deliberately
 * approximates history-dependent abilities (they are handled by the AI).
 */
export function previewClash(
  attacker: HeroCard,
  defender: HeroCard,
  attackerHp: number,
  defenderHp: number,
): number {
  let attack = attacker.attack;
  if (attacker.abilityId === 'crushing') attack += Math.floor(defender.defense / BALANCE.crushingDivisor);
  if (attacker.abilityId === 'bloodrage' && attackerHp <= BALANCE.lowHpThreshold) attack += BALANCE.bloodrageAttack;
  if (attacker.abilityId === 'duelist' && defender.attack > attacker.attack) attack += BALANCE.duelistAttack;

  let attackSpeed = attacker.speed;
  let defenderSpeed = defender.speed;
  if (attacker.abilityId === 'frostbind') defenderSpeed -= BALANCE.frostbindSpeed;
  if (defender.abilityId === 'frostbind') attackSpeed -= BALANCE.frostbindSpeed;
  if (attackSpeed - defenderSpeed >= BALANCE.speedEdgeThreshold && defender.abilityId !== 'precognition') {
    attack += BALANCE.speedBonus;
  }

  let defense = attacker.abilityId === 'blinkstrike' ? 0 : defender.defense;
  if (defender.abilityId === 'lastBastion' && defenderHp <= BALANCE.lowHpThreshold) defense += BALANCE.lastBastionDefense;
  if (defender.abilityId === 'precognition') defense += BALANCE.precognitionDefense;

  let dmg = Math.max(0, attack - defense);
  if (dmg > 0 && defender.abilityId === 'aegis') dmg = Math.max(1, dmg - BALANCE.aegisReduction);
  if (attacker.abilityId === 'overcharge') dmg += BALANCE.overchargeDamage;
  if (attacker.abilityId === 'ignition' && dmg > 0) dmg += BALANCE.burnDamage;
  return dmg;
}
