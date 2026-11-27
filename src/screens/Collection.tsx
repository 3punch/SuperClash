import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { HEROES } from '../game/data/heroes';
import { CLASSES, CLASS_ORDER, RARITIES, RARITY_ORDER } from '../game/data/meta';
import type { HeroCard, HeroClass, Rarity } from '../game/types';
import type { Stats } from '../game/storage';
import { HeroCard as HeroCardView } from '../components/cards/HeroCard';
import { CardDetail } from '../components/cards/CardDetail';
import { ScreenHeader } from '../components/layout/ScreenHeader';

export function Collection({
  unlocks,
  stats,
  onBack,
}: {
  unlocks: string[];
  stats: Stats;
  onBack: () => void;
}) {
  const [inspect, setInspect] = useState<HeroCard | null>(null);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<HeroClass | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');

  const list = useMemo(
    () =>
      HEROES.filter((hero) => unlocks.includes(hero.id))
        .filter((hero) => (cls === 'all' ? true : hero.class === cls))
        .filter((hero) => (rarity === 'all' ? true : hero.rarity === rarity))
        .filter((hero) =>
          query.trim().length === 0
            ? true
            : `${hero.name} ${hero.epithet} ${hero.description}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => RARITIES[b.rarity].rank - RARITIES[a.rarity].rank || a.name.localeCompare(b.name)),
    [unlocks, cls, rarity, query],
  );

  const ownedCount = unlocks.filter((id) => HEROES.some((h) => h.id === id)).length;

  return (
    <div className="screen screen--collection">
      <ScreenHeader
        title="Hero archive"
        subtitle={`${ownedCount} of ${HEROES.length} heroes unlocked`}
        onBack={onBack}
        right={
          <div className="collection__search">
            <Search size={15} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search heroes"
              aria-label="Search heroes"
            />
          </div>
        }
      />

      <div className="collection__filters">
        <div className="collection__group" role="group" aria-label="Filter by class">
          <button type="button" className={`chip ${cls === 'all' ? 'is-active' : ''}`} onClick={() => setCls('all')}>
            All classes
          </button>
          {CLASS_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${cls === id ? 'is-active' : ''}`}
              style={cls === id ? { color: CLASSES[id].color, borderColor: CLASSES[id].color } : undefined}
              onClick={() => setCls(id)}
            >
              {CLASSES[id].label}
            </button>
          ))}
        </div>
        <div className="collection__group" role="group" aria-label="Filter by rarity">
          <button
            type="button"
            className={`chip ${rarity === 'all' ? 'is-active' : ''}`}
            onClick={() => setRarity('all')}
          >
            All rarities
          </button>
          {RARITY_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${rarity === id ? 'is-active' : ''}`}
              style={rarity === id ? { color: RARITIES[id].color, borderColor: RARITIES[id].color } : undefined}
              onClick={() => setRarity(id)}
            >
              {RARITIES[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="collection__grid">
        {list.map((hero) => {
          const record = stats.perHero[hero.id];
          const winrate = record && record.plays > 0 ? Math.round((record.wins / record.plays) * 100) : null;
          return (
            <div key={hero.id} className="collection__item">
              <HeroCardView card={hero} size="md" onClick={() => setInspect(hero)} />
              <div className="collection__record">
                {record && record.plays > 0 ? (
                  <>
                    <Sparkles size={11} /> {record.plays} plays · {winrate}% win
                  </>
                ) : (
                  <span className="muted">Not fielded yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {list.length === 0 ? <p className="collection__empty">No heroes match that filter.</p> : null}

      {inspect ? <CardDetail card={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}
