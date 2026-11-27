import { memo } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { ABILITIES } from '../../game/data/abilities';
import { CLASSES, RARITIES } from '../../game/data/meta';
import type { HeroCard as HeroCardType } from '../../game/types';
import { StatRow, EnergyCost } from './Stats';
import { HeroArt } from './HeroArt';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'hand';

interface HeroCardProps {
  card: HeroCardType;
  size?: CardSize;
  /** Compact dock variant: drops the long ability paragraph. */
  hand?: boolean;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  used?: boolean;
  locked?: boolean;
  freePlay?: boolean;
  showAbility?: boolean;
  onClick?: (card: HeroCardType) => void;
  onInspect?: (card: HeroCardType) => void;
  className?: string;
  badge?: string;
}

export const HeroCard = memo(function HeroCard({
  card,
  size = 'md',
  selected,
  hand,
  disabled,
  dimmed,
  used,
  locked,
  freePlay,
  showAbility = true,
  onClick,
  onInspect,
  className = '',
  badge,
}: HeroCardProps) {
  const rarity = RARITIES[card.rarity];
  const heroClass = CLASSES[card.class];
  const ability = ABILITIES[card.abilityId];
  const interactive = Boolean(onClick) && !disabled && !locked;

  const handleClick = () => {
    if (!interactive) return;
    onClick?.(card);
  };

  return (
    <div
      className={[
        'hero-card',
        `hero-card--${size}`,
        hand ? 'hero-card--hand' : '',
        `hero-card--${card.rarity}`,
        selected ? 'is-selected' : '',
        disabled ? 'is-disabled' : '',
        dimmed ? 'is-dimmed' : '',
        used ? 'is-used' : '',
        interactive ? 'is-interactive' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--accent': card.accent,
          '--rarity': rarity.color,
          '--rarity-glow': rarity.glow,
        } as React.CSSProperties
      }
      onClick={handleClick}
      onKeyDown={(event) => {
        if (!interactive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? Boolean(selected) : undefined}
      aria-label={`${card.name}, ${heroClass.label}, ${rarity.label}. Attack ${card.attack}, Defence ${card.defense}, Speed ${card.speed}. ${ability.name}: ${ability.rules}`}
      aria-disabled={disabled || locked || undefined}
    >
      <div className="hero-card__frame" aria-hidden />
      <div className="hero-card__inner">
        <div className="hero-card__art">
          <HeroArt card={card} />
          <div className="hero-card__artshade" aria-hidden />
          <div className="halftone" aria-hidden />
          <div className="hero-card__topline">
            <span className="hero-card__rarity" style={{ color: rarity.color }}>
              <i className="hero-card__raritygem" />
              {rarity.label}
            </span>
            <EnergyCost cost={card.energyCost} free={freePlay} />
          </div>
          {badge ? <span className="hero-card__badge">{badge}</span> : null}
          {size !== 'xs' ? (
            <div className="hero-card__nameline">
              <h3 className="hero-card__name">{card.name}</h3>
              {size !== 'sm' ? <p className="hero-card__epithet">{card.epithet}</p> : null}
            </div>
          ) : null}
        </div>

        {size !== 'xs' ? (
          <div className="hero-card__body">
            <div className="hero-card__meta">
              <span className="hero-card__class" style={{ color: heroClass.color }}>
                {heroClass.label}
              </span>
              <StatRow card={card} compact={size === 'sm'} />
            </div>
            {showAbility && size !== 'sm' ? (
              <div className="hero-card__ability">
                <span className="hero-card__abilityname">
                  <Sparkles size={11} strokeWidth={2.6} /> {ability.name}
                </span>
                <p className="hero-card__abilitytext">{ability.rules}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {selected ? <span className="hero-card__selectmark" aria-hidden /> : null}
      {used ? (
        <span className="hero-card__veil">
          <span>USED</span>
        </span>
      ) : null}
      {locked ? (
        <span className="hero-card__veil hero-card__veil--lock">
          <Lock size={22} />
          <span>LOCKED</span>
        </span>
      ) : null}
      {onInspect && !locked ? (
        <button
          type="button"
          className="hero-card__inspect"
          aria-label={`Inspect ${card.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onInspect(card);
          }}
        />
      ) : null}
    </div>
  );
});

export function HeroCardSkeleton({ size = 'md' }: { size?: CardSize }) {
  return <div className={`hero-card hero-card--${size} hero-card--skeleton`} aria-hidden />;
}
