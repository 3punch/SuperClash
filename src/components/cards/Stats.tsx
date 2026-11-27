import { Swords, Shield, Zap } from 'lucide-react';
import type { HeroCard } from '../../game/types';

const ICONS = { attack: Swords, defense: Shield, speed: Zap } as const;

export function StatBar({
  kind,
  value,
  max = 10,
  compact,
}: {
  kind: 'attack' | 'defense' | 'speed';
  value: number;
  max?: number;
  compact?: boolean;
}) {
  const Icon = ICONS[kind];
  return (
    <div className={`stat stat--${kind} ${compact ? 'stat--compact' : ''}`}>
      <span className="stat__icon">
        <Icon size={compact ? 11 : 13} strokeWidth={2.6} />
      </span>
      <span className="stat__value">{value}</span>
      {!compact ? (
        <span className="stat__track">
          <span className="stat__fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
        </span>
      ) : null}
    </div>
  );
}

export function StatRow({ card, compact }: { card: HeroCard; compact?: boolean }) {
  return (
    <div className="statrow">
      <StatBar kind="attack" value={card.attack} compact={compact} />
      <StatBar kind="defense" value={card.defense} compact={compact} />
      <StatBar kind="speed" value={card.speed} compact={compact} />
    </div>
  );
}

export function EnergyCost({ cost, free }: { cost: number; free?: boolean }) {
  return (
    <span
      className={`energy ${free ? 'energy--free' : ''}`}
      title={free ? 'Plays free — no affordable cards' : `Costs ${cost} energy`}
      aria-label={free ? 'Plays free' : `Energy cost ${cost}`}
    >
      <Zap size={12} strokeWidth={3} />
      {free ? 'FREE' : cost}
    </span>
  );
}

export function ClassBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="class-badge" style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

export function StatPips({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="pips" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? 'pips__on' : ''} />
      ))}
    </span>
  );
}
