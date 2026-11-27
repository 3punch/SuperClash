import { useState } from 'react';
import {
  Brain,
  Flame,
  Shield,
  Swords,
  Wind,
} from 'lucide-react';
import { HERO_ART_AVAILABLE } from '../../game/data/heroes';
import type { HeroCard, HeroClass } from '../../game/types';

const CLASS_GLYPH: Record<HeroClass, typeof Shield> = {
  tank: Shield,
  fighter: Swords,
  speed: Wind,
  tactician: Brain,
  special: Flame,
};

/**
 * Character artwork with a designed fallback.
 *
 * If an image is missing (or fails to load) we render a comic-style
 * stand-in built from the hero's accent colour and monogram, so a missing
 * asset never looks like a broken card.
 */
export function HeroArt({
  card,
  className,
  eager,
}: {
  card: HeroCard;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const hasArt = HERO_ART_AVAILABLE.has(card.id) && !failed;

  if (!hasArt) {
    const Glyph = CLASS_GLYPH[card.class];
    return (
      <span
        className={`hero-art-fallback ${className ?? ''}`}
        role="img"
        aria-label={`${card.name} emblem`}
      >
        <span className="hero-art-fallback__rays" aria-hidden />
        <span className="hero-art-fallback__halftone" aria-hidden />
        <span className="hero-art-fallback__burst" aria-hidden />
        <span className="hero-art-fallback__emblem" aria-hidden>
          <Glyph className="hero-art-fallback__glyph" size={16} strokeWidth={2.6} />
          <span className="hero-art-fallback__mono">{card.monogram}</span>
        </span>
        <span className="hero-art-fallback__label" aria-hidden>
          {card.class.toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    // Decorative: the card itself exposes a full aria-label, so the
    // artwork must not be announced twice.
    <img
      className={className}
      src={card.artwork}
      alt=""
      aria-hidden
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
