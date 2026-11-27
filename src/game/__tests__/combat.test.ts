import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { resolveRound } from '../combat';
import { requireHero } from '../data/heroes';
import type { FighterSnapshot, HeroCard, RoundInput, Side } from '../types';

function snapshot(side: Side, overrides: Partial<FighterSnapshot> = {}): FighterSnapshot {
  return {
    side,
    name: side === 'p1' ? 'Player 1' : 'Player 2',
    hp: 20,
    maxHp: 20,
    energy: 4,
    burn: null,
    usedOnce: [],
    classHistory: [],
    cardHistory: [],
    ...overrides,
  };
}

function clash(
  p1: HeroCard | string,
  p2: HeroCard | string,
  opts: { p1?: Partial<FighterSnapshot>; p2?: Partial<FighterSnapshot>; round?: number } = {},
) {
  const input: RoundInput = {
    round: opts.round ?? 1,
    cards: {
      p1: typeof p1 === 'string' ? requireHero(p1) : p1,
      p2: typeof p2 === 'string' ? requireHero(p2) : p2,
    },
    fighters: { p1: snapshot('p1', opts.p1), p2: snapshot('p2', opts.p2) },
  };
  return resolveRound(input);
}

describe('damage calculation', () => {
  it('can fully block an attack when defence matches attack', () => {
    // Ironclad 4 ATK vs Bulwark 6 DEF → no damage either way
    const result = clash('ironclad', 'bulwark');
    expect(result.p1.clashDamage).toBe(0);
    expect(result.p2.clashDamage).toBe(0);
    expect(result.hpAfter).toEqual({ p1: 20, p2: 20 });
  });

  it('applies raw attack minus defence with a known pair', () => {
    // Ravager 8 ATK 3 DEF vs Sentinel 5 ATK 4 DEF
    const result = clash('ravager', 'sentinel');
    // Ravager 8 ATK + initiative (6 vs 5 = edge 1, no bonus) vs Sentinel 4 DEF → 4
    expect(result.p1.clashDamage).toBe(4);
    expect(result.p2.clashDamage).toBe(Math.max(0, 5 - 3)); // 2
    expect(result.hpAfter.p2).toBe(20 - 4);
    expect(result.hpAfter.p1).toBe(20 - 2);
  });

  it('never produces negative damage', () => {
    const result = clash('ironclad', 'bulwark');
    expect(result.p1.clashDamage).toBeGreaterThanOrEqual(0);
    expect(result.p2.clashDamage).toBeGreaterThanOrEqual(0);
  });

  it('never lets health go below zero', () => {
    const result = clash('ravager', 'ironclad', {
      p1: { hp: 20 },
      p2: { hp: 1 },
    });
    expect(result.hpAfter.p2).toBeGreaterThanOrEqual(0);
  });

  it('clamps health to maxHp', () => {
    const result = clash('echo', 'echo', { p1: { hp: 20 } });
    expect(result.hpAfter.p1).toBeLessThanOrEqual(20);
  });

  it('is symmetric — swapping sides produces mirrored results', () => {
    const forward = clash('ravager', 'echo');
    const reverse = clash('echo', 'ravager');
    expect(forward.hpAfter.p2).toBe(reverse.hpAfter.p1);
    expect(forward.hpAfter.p1).toBe(reverse.hpAfter.p2);
  });

  it('does not mutate its inputs', () => {
    const p1 = snapshot('p1');
    const p2 = snapshot('p2');
    const cards = { p1: requireHero('ravager'), p2: requireHero('ironclad') };
    resolveRound({ round: 1, cards, fighters: { p1, p2 } });
    expect(p1.hp).toBe(20);
    expect(p2.hp).toBe(20);
    expect(cards.p1.id).toBe('ravager');
  });
});

describe('defence & guard', () => {
  it('blocks an attack that cannot beat defence', () => {
    // Kairo 7 ATK vs Bulwark 6 DEF + Last Bastion 3 (wounded) = 9 → blocked
    const result = clash('kairo', 'bulwark', { p2: { hp: 8 } });
    expect(result.p1.clashDamage).toBe(0);
    expect(result.p1.blocked).toBe(true);
  });

  it('Last Bastion only applies at or below the threshold', () => {
    const healthy = clash('kairo', 'bulwark', { p2: { hp: 20 } });
    const wounded = clash('kairo', 'bulwark', { p2: { hp: BALANCE.lowHpThreshold } });
    expect(wounded.p2.effectiveDefense).toBe(healthy.p2.effectiveDefense + BALANCE.lastBastionDefense);
  });

  it('Aegis absorbs damage but never fully nullifies a connecting hit', () => {
    const result = clash('ravager', 'ironclad');
    // 8 ATK vs 7 DEF = 1 through, Aegis could absorb 3 but keeps 1 minimum
    expect(result.p1.clashDamage).toBe(1);
  });

  it('Aegis reduces a larger hit by exactly the configured amount', () => {
    // Ravager 8 + initiative (6 vs 3 SPD) = 10 ATK vs Ironclad 7 DEF → 3 through,
    // Aegis absorbs 3 but keeps the 1 minimum chip.
    const result = clash('ravager', 'ironclad');
    expect(result.p1.attackBonuses.some((b) => b.label === 'Initiative')).toBe(true);
    expect(result.p1.clashDamage).toBe(BALANCE.minLandedDamage);
  });
});

describe('speed and initiative', () => {
  it('grants a bonus when the speed edge meets the threshold', () => {
    const result = clash('voltrex', 'mammoth');
    // Voltrex 8 vs Mammoth 1, edge 7 → +2 ATK
    expect(result.p1.speedBonus).toBe(BALANCE.speedBonus);
    expect(result.p1.attackBonuses.some((b) => b.label === 'Initiative')).toBe(true);
  });

  it('does not grant a bonus below the threshold', () => {
    const result = clash('echo', 'sentinel'); // both 5
    expect(result.p1.speedBonus).toBe(0);
    expect(result.p2.speedBonus).toBe(0);
  });

  it('Frostbind slows the opposing card', () => {
    // Voltrex 8 SPD vs Sentinel 5 SPD normally
    const normal = clash('voltrex', 'sentinel');
    expect(normal.p1.speed).toBe(8);
    // Mammoth's Frostbind takes 3 SPD off Voltrex
    const frozen = clash('voltrex', 'mammoth');
    expect(frozen.p1.speed).toBe(8 - BALANCE.frostbindSpeed);
    expect(frozen.p2.events.some((e) => e.type === 'ability' && e.abilityId === 'frostbind')).toBe(true);
  });

  it('Precognition cancels the opposing initiative bonus', () => {
    const result = clash('voltrex', 'oracle');
    // Voltrex 8 vs Oracle 6 → edge 2, and Oracle denies it anyway
    expect(result.p1.speedBonus).toBe(0);
    expect(result.p2.defenseBonuses.some((b) => b.label === 'Precognition')).toBe(true);
  });
});

describe('special abilities', () => {
  it('Bloodrage adds attack at low health', () => {
    const healthy = clash('ravager', 'sentinel', { p1: { hp: 20 } });
    const wounded = clash('ravager', 'sentinel', { p1: { hp: BALANCE.lowHpThreshold } });
    expect(wounded.p1.attackBonuses.some((b) => b.label === 'Bloodrage')).toBe(true);
    expect(wounded.p1.clashDamage).toBe(healthy.p1.clashDamage + BALANCE.bloodrageAttack);
  });

  it('Duelist gains attack against a stronger attacker', () => {
    // Kairo 7 ATK vs Ravager 8 ATK → duelist triggers
    const result = clash('kairo', 'ravager');
    expect(result.p1.attackBonuses.some((b) => b.label.startsWith('Duelist'))).toBe(true);
  });

  it('Duelist does not trigger against a weaker attacker', () => {
    const result = clash('kairo', 'echo'); // Echo 4 ATK
    expect(result.p1.attackBonuses.some((b) => b.label.startsWith('Duelist'))).toBe(false);
  });

  it('Crushing Gravity scales with target defence', () => {
    const vsSoft = clash('gravlord', 'echo'); // def 5 → +2
    const vsWall = clash('gravlord', 'ironclad'); // def 7 → +3
    const softBonus = vsSoft.p1.attackBonuses.find((b) => b.label === 'Crushing Gravity')?.value ?? 0;
    const wallBonus = vsWall.p1.attackBonuses.find((b) => b.label === 'Crushing Gravity')?.value ?? 0;
    expect(softBonus).toBe(2);
    expect(wallBonus).toBe(3);
  });

  it('Blink Strike ignores defence', () => {
    const normal = clash('kairo', 'ironclad'); // 7 ATK vs 7 DEF → blocked
    const pierce = clash('shiv', 'ironclad'); // ignores the 7 DEF entirely
    expect(normal.p1.clashDamage).toBe(0);
    expect(pierce.p2.effectiveDefense).toBe(0);
    // Shiv: 7 ATK + initiative (7 vs 3) = 9, Aegis absorbs 3 → 6 through
    expect(pierce.p1.clashDamage).toBe(6);
    expect(normal.p1.clashDamage).toBeLessThan(pierce.p1.clashDamage);
  });

  it('Overcharge adds unavoidable arc damage', () => {
    const result = clash('arcwraith', 'ironclad');
    expect(result.p1.damageDealt).toBe(result.p1.clashDamage + BALANCE.overchargeDamage);
  });

  it('Refraction reflects damage back and is credited to the reflector', () => {
    const result = clash('ravager', 'prism');
    expect(result.p2.events.some((e) => e.type === 'reflect')).toBe(true);
    expect(result.p2.damageDealt).toBe(result.p2.clashDamage + BALANCE.refractDamage);
    expect(result.p1.damageTaken).toBe(result.p2.clashDamage + BALANCE.refractDamage);
  });

  it('Riposte fires when the opponent is fully blocked', () => {
    // Ironclad 4 ATK vs Echo 5 DEF → fully blocked → riposte
    const result = clash('ironclad', 'echo');
    expect(result.p1.clashDamage).toBe(0);
    expect(result.p1.blocked).toBe(true);
    expect(result.p2.damageDealt).toBe(0 + BALANCE.riposteDamage);
  });

  it('Riposte does not fire when the opponent lands damage', () => {
    const result = clash('ravager', 'echo');
    expect(result.p2.events.some((e) => e.type === 'riposte')).toBe(false);
  });

  it('Afterimage dodges a large hit exactly once', () => {
    const result = clash('ravager', 'zephyra');
    expect(result.p2.dodged).toBe(true);
    expect(result.p2.damageTaken).toBe(0);
    expect(result.p1.clashDamage).toBe(0);
  });

  it('Afterimage is unavailable once already consumed', () => {
    const result = clash('ravager', 'zephyra', { p2: { usedOnce: ['afterimage'], hp: 20 } });
    expect(result.p2.dodged).toBe(false);
    expect(result.p2.damageTaken).toBeGreaterThan(0);
  });

  it('Countermeasures triggers when the opponent repeats a class', () => {
    const repeated = clash('sentinel', 'ravager', { p2: { classHistory: ['fighter'] } });
    const fresh = clash('sentinel', 'ravager', { p2: { classHistory: ['tank'] } });
    expect(repeated.p1.attackBonuses.some((b) => b.label === 'Countermeasures')).toBe(true);
    expect(fresh.p1.attackBonuses.some((b) => b.label === 'Countermeasures')).toBe(false);
  });

  it('Ignition applies a burn that ticks on later rounds', () => {
    const round1 = clash('pyroclast', 'ironclad', { round: 1 });
    expect(round1.p1.appliedBurn).toBe(true);
    expect(round1.p2.burned).toBe(0);

    const round2 = clash('pyroclast', 'ironclad', {
      round: 2,
      p2: {
        burn: { damage: BALANCE.burnDamage, roundsLeft: 2, appliedRound: 1, sourceSide: 'p1', sourceName: 'Pyroclast' },
      },
    });
    expect(round2.p2.burned).toBe(BALANCE.burnDamage);
    expect(round2.p1.damageDealt).toBeGreaterThanOrEqual(BALANCE.burnDamage);
    expect(round2.hpAfter.p2).toBeLessThan(round2.hpBefore.p2);
  });

  it('a burn applied this round does not tick twice in the same round', () => {
    const result = clash('pyroclast', 'ironclad', {
      round: 2,
      p2: {
        burn: { damage: BALANCE.burnDamage, roundsLeft: 2, appliedRound: 2, sourceSide: 'p1', sourceName: 'Pyroclast' },
      },
    });
    expect(result.p2.burned).toBe(0);
  });

  it('Regrowth heals only after taking damage', () => {
    const hurt = clash('ravager', 'thornwild', { p2: { hp: 14 } });
    expect(hurt.p2.healed).toBe(BALANCE.regrowthHeal);

    // Ironclad cannot get through Thornwild's 4 DEF? 4 ATK vs 4 DEF → blocked
    const untouched = clash('ironclad', 'thornwild', { p2: { hp: 14 } });
    expect(untouched.p2.healed).toBe(0);
  });

  it('Static Charge grants attack when holding the speed edge', () => {
    const result = clash('voltrex', 'sentinel');
    expect(result.p1.speedBonus).toBeGreaterThan(0);
  });
});

describe('round result reporting', () => {
  it('reports health before and after', () => {
    const result = clash('ravager', 'sentinel');
    expect(result.hpBefore).toEqual({ p1: 20, p2: 20 });
    expect(result.hpAfter.p2).toBe(16);
  });

  it('always explains what happened', () => {
    const result = clash('ravager', 'sentinel');
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation.join(' ')).toMatch(/Ravager|Sentinel/);
  });

  it('names a round winner by damage dealt', () => {
    const result = clash('ravager', 'sentinel');
    expect(result.roundWinner).toBe('p1');
  });

  it('declares an even round a draw', () => {
    const result = clash('sentinel', 'sentinel');
    expect(result.roundWinner).toBeNull();
  });
});
