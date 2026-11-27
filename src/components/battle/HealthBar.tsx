import { useEffect, useRef, useState } from 'react';
import { Flame, Heart } from 'lucide-react';
import { BALANCE } from '../../game/balance';
import type { BurnState } from '../../game/types';

export function HealthBar({
  hp,
  maxHp = BALANCE.maxHp,
  name,
  label,
  side,
  burn,
  active,
  compact,
}: {
  hp: number;
  maxHp?: number;
  name: string;
  label?: string;
  side: 'p1' | 'p2';
  burn?: BurnState | null;
  active?: boolean;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const [flash, setFlash] = useState<'damage' | 'heal' | null>(null);
  const prev = useRef(hp);

  useEffect(() => {
    if (hp === prev.current) return;
    setFlash(hp < prev.current ? 'damage' : 'heal');
    const timer = window.setTimeout(() => setFlash(null), 520);
    prev.current = hp;
    return () => window.clearTimeout(timer);
  }, [hp]);

  const danger = hp <= 5;
  const low = hp <= BALANCE.lowHpThreshold;

  return (
    <div
      className={[
        'hpbar',
        `hpbar--${side}`,
        danger ? 'is-danger' : low ? 'is-low' : '',
        active ? 'is-active' : '',
        compact ? 'hpbar--compact' : '',
        flash ? `is-${flash}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="hpbar__meta">
        <span className="hpbar__name">
          {label ? <em className="hpbar__label">{label}</em> : null}
          {name}
        </span>
        <span className="hpbar__numbers">
          {burn ? (
            <span className="hpbar__burn" title={`Burning: ${burn.damage} damage for ${burn.roundsLeft} more round(s)`}>
              <Flame size={12} /> {burn.roundsLeft}
            </span>
          ) : null}
          <Heart size={12} className="hpbar__heart" />
          <strong>{hp}</strong>
          <span className="hpbar__max">/{maxHp}</span>
        </span>
      </div>
      <div className="hpbar__track">
        <div className="hpbar__ghost" style={{ width: `${pct}%` }} />
        <div className="hpbar__fill" style={{ width: `${pct}%` }}>
          <span className="hpbar__shine" aria-hidden />
        </div>
        <span className="hpbar__tick" style={{ left: '25%' }} aria-hidden />
        <span className="hpbar__tick" style={{ left: '50%' }} aria-hidden />
        <span className="hpbar__tick" style={{ left: '75%' }} aria-hidden />
      </div>
    </div>
  );
}
