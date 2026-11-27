import { X } from 'lucide-react';
import { ABILITIES } from '../../game/data/abilities';
import { CLASSES, RARITIES } from '../../game/data/meta';
import type { HeroCard } from '../../game/types';
import { EnergyCost } from './Stats';
import { HeroArt } from './HeroArt';
import { IconButton } from '../common/Buttons';

export function CardDetail({ card, onClose }: { card: HeroCard; onClose: () => void }) {
  const rarity = RARITIES[card.rarity];
  const heroClass = CLASSES[card.class];
  const ability = ABILITIES[card.abilityId];

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`${card.name} details`}>
      <button type="button" className="modal__scrim" aria-label="Close" onClick={onClose} />
      <div
        className="modal__panel card-detail"
        style={{ '--accent': card.accent, '--rarity': rarity.color } as React.CSSProperties}
      >
        <IconButton label="Close" onClick={onClose} className="modal__close">
          <X size={20} />
        </IconButton>

        <div className="card-detail__art">
          <HeroArt card={card} eager />
          <div className="halftone" aria-hidden />
          <div className="card-detail__artshade" aria-hidden />
          <div className="card-detail__headline">
            <span className="card-detail__rarity" style={{ color: rarity.color }}>
              {rarity.label}
            </span>
            <h2 className="card-detail__name">{card.name}</h2>
            <p className="card-detail__epithet">{card.epithet}</p>
          </div>
        </div>

        <div className="card-detail__body">
          <div className="card-detail__badges">
            <span className="card-detail__class" style={{ color: heroClass.color, borderColor: heroClass.color }}>
              {heroClass.label}
            </span>
            <EnergyCost cost={card.energyCost} />
          </div>

          <div className="card-detail__stats">
            {(
              [
                ['ATK', card.attack, 'attack'],
                ['DEF', card.defense, 'defense'],
                ['SPD', card.speed, 'speed'],
              ] as const
            ).map(([label, value, kind]) => (
              <div key={kind} className={`card-detail__stat card-detail__stat--${kind}`}>
                <span className="card-detail__statlabel">{label}</span>
                <span className="card-detail__statvalue">{value}</span>
                <span className="card-detail__statbar">
                  <i style={{ width: `${Math.min(100, (value / 10) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>

          <div className="card-detail__ability" style={{ borderColor: ability.color }}>
            <div className="card-detail__abilityhead">
              <span className="label" style={{ color: ability.color }}>
                Special ability
              </span>
              <span className="pill" style={{ color: ability.color, borderColor: ability.color }}>
                {ability.kind === 'passive' ? 'Passive' : ability.kind === 'oncePerMatch' ? 'Once per match' : 'Triggered'}
              </span>
            </div>
            <h3 className="card-detail__abilityname">{ability.name}</h3>
            <p className="card-detail__abilitytext">{ability.rules}</p>
          </div>

          <p className="card-detail__flavour">{card.description}</p>
        </div>
      </div>
    </div>
  );
}
