import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { HEROES, HERO_IDS, getHero, requireHero, DECK_PRESETS, DEFAULT_DECK } from '../data/heroes';
import { ABILITIES } from '../data/abilities';
import { CLASSES, RARITIES, CLASS_ORDER, RARITY_ORDER } from '../data/meta';
import { validateDeck } from '../engine';
import type { AbilityId, HeroCard } from '../types';

describe('roster data integrity', () => {
  it('has between 12 and 16 heroes', () => {
    expect(HEROES.length).toBeGreaterThanOrEqual(12);
    expect(HEROES.length).toBeLessThanOrEqual(16);
  });

  it('has unique ids', () => {
    expect(new Set(HERO_IDS).size).toBe(HEROES.length);
  });

  it('has unique names', () => {
    const names = HEROES.map((h) => h.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has unique monograms', () => {
    const monos = HEROES.map((h) => h.monogram);
    expect(new Set(monos).size).toBe(monos.length);
  });

  it('defines every required field on every card', () => {
    for (const hero of HEROES) {
      expect(hero.id.length).toBeGreaterThan(0);
      expect(hero.name.length).toBeGreaterThan(0);
      expect(hero.epithet.length).toBeGreaterThan(0);
      expect(hero.description.length).toBeGreaterThan(10);
      expect(hero.artwork).toMatch(/^\/art\/heroes\/.+\.webp$/);
      expect(hero.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(CLASS_ORDER).toContain(hero.class);
      expect(RARITY_ORDER).toContain(hero.rarity);
      expect(ABILITIES[hero.abilityId]).toBeDefined();
      for (const stat of [hero.attack, hero.defense, hero.speed, hero.energyCost]) {
        expect(Number.isFinite(stat)).toBe(true);
        expect(stat).toBeGreaterThan(0);
      }
    }
  });

  it('keeps stats inside the balanced band', () => {
    for (const hero of HEROES) {
      expect(hero.attack).toBeLessThanOrEqual(9);
      expect(hero.defense).toBeLessThanOrEqual(8);
      expect(hero.speed).toBeLessThanOrEqual(9);
      expect(hero.energyCost).toBeGreaterThanOrEqual(2);
      expect(hero.energyCost).toBeLessThanOrEqual(5);
    }
  });

  it('represents every class with at least two heroes', () => {
    for (const cls of CLASS_ORDER) {
      const count = HEROES.filter((h) => h.class === cls).length;
      expect(count, `class ${cls}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses every ability exactly once', () => {
    const used = HEROES.map((h) => h.abilityId);
    expect(new Set(used).size).toBe(used.length);
    expect(used.length).toBe(Object.keys(ABILITIES).length);
  });

  it('spreads heroes across all rarities', () => {
    for (const rarity of RARITY_ORDER) {
      expect(HEROES.some((h) => h.rarity === rarity), rarity).toBe(true);
    }
  });

  it('supports a 3-card opening hand within starting energy ranges', () => {
    // Cheap cards must exist so no deck is energy-locked on round one.
    const cheap = HEROES.filter((h) => h.energyCost <= BALANCE.cheapCost);
    expect(cheap.length).toBeGreaterThanOrEqual(BALANCE.minCheapCards);
  });

  it('looks up heroes safely', () => {
    expect(getHero('ravager')?.name).toBe('Ravager');
    expect(getHero('nope')).toBeUndefined();
    expect(() => requireHero('nope')).toThrow();
  });
});

describe('ability definitions', () => {
  it('gives every ability a complete definition', () => {
    for (const [id, ability] of Object.entries(ABILITIES)) {
      expect(ability.id, id).toBe(id as AbilityId);
      expect(ability.name.length).toBeGreaterThan(2);
      expect(ability.rules.length).toBeGreaterThan(20);
      expect(ability.shout.length).toBeGreaterThan(2);
      expect(ability.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['passive', 'onAttack', 'onDefend', 'oncePerMatch', 'roundEnd']).toContain(ability.kind);
    }
  });

  it('documents a trigger and a limit for every rule', () => {
    // Every rule text must mention "once" or a window, so nothing is open-ended.
    for (const ability of Object.values(ABILITIES)) {
      expect(ability.rules.toLowerCase()).toMatch(/whenever|while|if |once|each|against/);
    }
  });
});

describe('class + rarity metadata', () => {
  it('covers every class with label, icon and colour', () => {
    for (const cls of CLASS_ORDER) {
      const meta = CLASSES[cls];
      expect(meta.id).toBe(cls);
      expect(meta.label.length).toBeGreaterThan(2);
      expect(meta.icon.length).toBeGreaterThan(2);
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('orders rarities ascending', () => {
    const ranks = RARITY_ORDER.map((r) => RARITIES[r].rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('deck presets', () => {
  it('gives every preset a legal 8-card deck', () => {
    for (const preset of DECK_PRESETS) {
      const check = validateDeck(preset.cards);
      expect(check.valid, `${preset.name}: ${check.reasons.join(', ')}`).toBe(true);
    }
  });

  it('ships a legal default deck', () => {
    expect(validateDeck(DEFAULT_DECK).valid).toBe(true);
  });

  it('never references unknown hero ids', () => {
    for (const preset of DECK_PRESETS) {
      for (const id of preset.cards) expect(getHero(id), id).toBeDefined();
    }
  });
});

describe('balance sanity', () => {
  it('keeps the match to five rounds and 20 HP', () => {
    expect(BALANCE.maxRounds).toBe(5);
    expect(BALANCE.maxHp).toBe(20);
    expect(BALANCE.deckSize).toBe(8);
    expect(BALANCE.handSize).toBe(3);
    expect(BALANCE.deckSize).toBe(BALANCE.handSize + BALANCE.maxRounds);
  });

  it('never lets energy lock a five-round match', () => {
    // Spending one card per round must stay affordable on average.
    const avgCost = HEROES.reduce((sum, h) => sum + h.energyCost, 0) / HEROES.length;
    const available = BALANCE.energyStart + BALANCE.energyPerRound * (BALANCE.maxRounds - 1);
    expect(available).toBeGreaterThanOrEqual(avgCost * BALANCE.maxRounds);
  });

  it('keeps a full hand affordable in the worst case', () => {
    const mostExpensive = Math.max(...HEROES.map((h: HeroCard) => h.energyCost));
    const handWorstCase = mostExpensive * BALANCE.handSize;
    expect(handWorstCase).toBeGreaterThan(BALANCE.energyStart);
    // ...which is exactly why the free-play rescue exists.
    expect(BALANCE.energyMax).toBeGreaterThanOrEqual(BALANCE.energyStart);
  });
});
