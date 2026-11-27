import { useMemo, useState } from 'react';
import { AlertTriangle, Check, RotateCcw, Shuffle, Sparkles, Swords } from 'lucide-react';
import { BALANCE } from '../game/balance';
import { DECK_PRESETS, HEROES } from '../game/data/heroes';
import { CLASSES, CLASS_ORDER } from '../game/data/meta';
import { validateDeck } from '../game/engine';
import type { AIDifficulty, HeroCard, HeroClass, MatchMode } from '../game/types';
import { Button } from '../components/common/Buttons';
import { HeroCard as HeroCardView } from '../components/cards/HeroCard';
import { HeroArt } from '../components/cards/HeroArt';
import { CardDetail } from '../components/cards/CardDetail';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { sfx } from '../audio/sound';

export function DeckSelect({
  mode,
  difficulty,
  unlocks,
  initialPlayerDeck,
  initialOpponentDeck,
  onBack,
  onConfirm,
}: {
  mode: MatchMode;
  difficulty: AIDifficulty;
  unlocks: string[];
  initialPlayerDeck: string[];
  initialOpponentDeck: string[];
  onBack: () => void;
  onConfirm: (playerDeck: string[], opponentDeck: string[]) => void;
}) {
  const [editing, setEditing] = useState<'p1' | 'p2'>('p1');
  const [p1Deck, setP1Deck] = useState<string[]>(initialPlayerDeck);
  const [p2Deck, setP2Deck] = useState<string[]>(initialOpponentDeck);
  const [filter, setFilter] = useState<HeroClass | 'all'>('all');
  const [inspect, setInspect] = useState<HeroCard | null>(null);

  const deck = editing === 'p1' ? p1Deck : p2Deck;
  const setDeck = editing === 'p1' ? setP1Deck : setP2Deck;
  const check = validateDeck(deck);
  const bothValid = validateDeck(p1Deck).valid && validateDeck(p2Deck).valid;
  const verified = check.valid;

  const pool = useMemo(
    () =>
      HEROES.filter((hero) => unlocks.includes(hero.id))
        .filter((hero) => filter === 'all' || hero.class === filter)
        .sort((a, b) => a.energyCost - b.energyCost || a.name.localeCompare(b.name)),
    [unlocks, filter],
  );

  const toggle = (card: HeroCard) => {
    if (deck.includes(card.id)) {
      setDeck(deck.filter((id) => id !== card.id));
      sfx.tap();
      return;
    }
    if (deck.length >= BALANCE.deckSize) {
      sfx.error();
      return;
    }
    setDeck([...deck, card.id]);
    sfx.select();
  };

  const applyPreset = (cards: string[]) => {
    setDeck([...cards]);
    sfx.lock();
  };

  const randomize = () => {
    const shuffled = [...HEROES].filter((h) => unlocks.includes(h.id)).sort(() => Math.random() - 0.5);
    const pick: string[] = [];
    for (const hero of shuffled) {
      if (pick.length >= BALANCE.deckSize) break;
      pick.push(hero.id);
    }
    if (!validateDeck(pick).valid) {
      // Guarantee the energy guardrail.
      const cheap = shuffled.filter((h) => h.energyCost <= 2).map((h) => h.id);
      for (const id of cheap) {
        if (validateDeck(pick).valid) break;
        if (pick.includes(id)) continue;
        pick[pick.length - 1] = id;
      }
    }
    setDeck(pick);
    sfx.lock();
  };

  const cheapCount = deck
    .map((id) => HEROES.find((h) => h.id === id))
    .filter((hero) => hero && hero.energyCost <= 2).length;

  return (
    <div className="screen screen--deck">
      <ScreenHeader
        title="Build your squad"
        subtitle={mode === 'ai' ? `Solo clash · ${difficulty.toUpperCase()} A.I.` : 'Local duel · Pass & play'}
        onBack={onBack}
        right={
          <div className="deck-tabs" role="tablist" aria-label="Editing deck">
            <button
              type="button"
              role="tab"
              aria-selected={editing === 'p1'}
              className={`deck-tabs__tab ${editing === 'p1' ? 'is-active' : ''}`}
              onClick={() => {
                sfx.tap();
                setEditing('p1');
              }}
            >
              Player 1
              <span className={validateDeck(p1Deck).valid ? 'ok' : 'bad'}>{p1Deck.length}/8</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editing === 'p2'}
              className={`deck-tabs__tab ${editing === 'p2' ? 'is-active' : ''}`}
              onClick={() => {
                sfx.tap();
                setEditing('p2');
              }}
            >
              {mode === 'ai' ? 'A.I. deck' : 'Player 2'}
              <span className={validateDeck(p2Deck).valid ? 'ok' : 'bad'}>{p2Deck.length}/8</span>
            </button>
          </div>
        }
      />

      <div className="deck-layout">
        <section className="deck-pool" aria-label="Available heroes">
          <div className="deck-pool__filters" role="group" aria-label="Filter by class">
            <button
              type="button"
              className={`chip ${filter === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {CLASS_ORDER.map((cls) => {
              const meta = CLASSES[cls];
              return (
                <button
                  key={cls}
                  type="button"
                  className={`chip ${filter === cls ? 'is-active' : ''}`}
                  style={filter === cls ? { color: meta.color, borderColor: meta.color } : undefined}
                  onClick={() => setFilter(cls)}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="deck-pool__grid">
            {pool.map((hero) => (
              <HeroCardView
                key={hero.id}
                card={hero}
                size="sm"
                selected={deck.includes(hero.id)}
                disabled={!deck.includes(hero.id) && deck.length >= BALANCE.deckSize}
                onClick={toggle}
                onInspect={setInspect}
                showAbility={false}
              />
            ))}
          </div>
        </section>

        <aside className="deck-side">
          <div className="deck-side__head">
            <span className="label">{editing === 'p1' ? 'Your deck' : mode === 'ai' ? 'A.I. deck' : 'Player 2 deck'}</span>
            <span className="deck-side__count">
              {deck.length}
              <small>/{BALANCE.deckSize}</small>
            </span>
          </div>

          <div className="deck-side__slots">
            {Array.from({ length: BALANCE.deckSize }, (_, i) => {
              const id = deck[i];
              const hero = id ? HEROES.find((h) => h.id === id) : undefined;
              return hero ? (
                <button
                  key={`${hero.id}-${i}`}
                  type="button"
                  className="slot slot--filled"
                  style={{ '--accent': hero.accent } as React.CSSProperties}
                  onClick={() => {
                    setDeck(deck.filter((cardId) => cardId !== hero.id));
                    sfx.tap();
                  }}
                  title={`Remove ${hero.name}`}
                >
                  <HeroArt card={hero} />
                  <span className="slot__name">{hero.name}</span>
                  <span className="slot__cost">{hero.energyCost}</span>
                  <span className="slot__remove" aria-hidden>
                    ×
                  </span>
                </button>
              ) : (
                <div key={`empty-${i}`} className="slot">
                  <span className="slot__empty">Empty</span>
                </div>
              );
            })}
          </div>

          <div className="deck-side__meta">
            <div className="deck-side__meter">
              <span className="label">Low cost</span>
              <span className={cheapCount >= BALANCE.minCheapCards ? 'ok' : 'bad'}>
                {cheapCount} / {BALANCE.minCheapCards} min
              </span>
            </div>
            {check.reasons.length > 0 ? (
              <ul className="deck-side__warnings">
                {check.reasons.map((reason) => (
                  <li key={reason}>
                    <AlertTriangle size={13} /> {reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="deck-side__ready">
                <Check size={14} /> Deck ready for battle
              </p>
            )}
          </div>

          <div className="deck-side__presets">
            <span className="label">Presets</span>
            <div className="deck-side__presetrow">
              {DECK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset"
                  title={preset.blurb}
                  onClick={() => applyPreset(preset.cards)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="deck-side__presetrow">
              <Button size="sm" variant="ghost" icon={<Shuffle size={14} />} onClick={randomize}>
                Random
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  setDeck(editing === 'p1' ? DECK_PRESETS[0].cards : DECK_PRESETS[2].cards);
                  sfx.tap();
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <Button
            size="lg"
            full
            slash
            icon={<Swords size={18} />}
            disabled={!bothValid}
            onClick={() => onConfirm(p1Deck, p2Deck)}
            className="deck-side__cta"
          >
            Enter the arena
          </Button>
          {!bothValid ? (
            <p className="deck-side__blocked">
              <Sparkles size={12} /> Both decks must be legal before the clash.
            </p>
          ) : null}
          {verified ? <span className="sr-only">Current deck is valid</span> : null}
        </aside>
      </div>

      {inspect ? <CardDetail card={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}
