/**
 * Every tunable combat number lives here so balance passes never touch UI code.
 */
export const BALANCE = {
  maxHp: 20,
  deckSize: 8,
  handSize: 3,
  maxRounds: 5,

  /**
   * Energy economy, tuned to the 5-round match length.
   * Average card cost is ~3.2, so a fighter must average slightly above that
   * to keep every hand interesting without ever being locked out entirely.
   *   round 1: 5 · then +3 per round · cap 12
   */
  energyStart: 5,
  energyMax: 12,
  energyPerRound: 3,

  /**
   * A connecting attack always chips at least 1 HP ("glancing blow").
   * Without this, defence stacking produces dead rounds where nothing happens.
   * Flat reductions (Aegis, dodges, guards) can still take it to 0.
   */
  minLandedDamage: 1,

  /** A speed edge of this size grants the initiative bonus. */
  speedEdgeThreshold: 3,
  speedBonus: 2,

  /** Ironclad — Aegis */
  aegisReduction: 3,
  /** Bulwark — Last Bastion */
  lastBastionDefense: 3,
  lowHpThreshold: 10,
  /** Mammoth — Frostbind */
  frostbindSpeed: 3,
  /** Ravager — Bloodrage */
  bloodrageAttack: 4,
  /** Kairo — Duelist */
  duelistAttack: 2,
  /** Grav-Lord — Crushing */
  crushingDivisor: 2,
  /** Voltrex — Static Charge */
  staticAttack: 2,
  /** Sentinel — Countermeasures */
  countermeasuresAttack: 3,
  /** Echo — Riposte */
  riposteDamage: 3,
  /** Oracle — Precognition */
  precognitionDefense: 2,
  /** Pyroclast — Ignition */
  burnDamage: 2,
  burnRounds: 2,
  /** Prism — Refract */
  refractDamage: 2,
  /** Thornwild — Regrowth */
  regrowthHeal: 2,
  /** Arcwraith — Overcharge */
  overchargeDamage: 2,

  /** Zephyra — Afterimage: dodge when the hit is big or the hero is in danger. */
  dodgeMinDamage: 5,
  dodgeDangerHp: 8,

  /** Deck construction guardrail: enough cheap cards to avoid energy locks. */
  minCheapCards: 2,
  cheapCost: 2,
} as const;

export type Balance = typeof BALANCE;
