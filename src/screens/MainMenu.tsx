import { useEffect, useState } from 'react';
import { BookOpen, Layers, Play, Settings as SettingsIcon, Swords, Trophy } from 'lucide-react';
import { HEROES, HERO_ART_AVAILABLE } from '../game/data/heroes';
import type { Stats } from '../game/storage';
import { Button } from '../components/common/Buttons';

export function MainMenu({
  stats,
  onPlay,
  onCollection,
  onSettings,
  onHowTo,
}: {
  stats: Stats;
  onPlay: () => void;
  onCollection: () => void;
  onSettings: () => void;
  onHowTo: () => void;
}) {
  const [featured] = useState(() =>
    [
      'ravager',
      'zephyra',
      'ironclad',
      'gravlord',
      'kairo',
      'voltrex',
      'mammoth',
      'bulwark',
    ]
      .map((id) => HEROES.find((h) => h.id === id))
      .filter((hero): hero is (typeof HEROES)[number] => Boolean(hero))
      .filter((hero) => HERO_ART_AVAILABLE.has(hero.id)),
  );

  useEffect(() => {
    document.title = 'SUPER CLASH — Comic Card Battler';
  }, []);

  return (
    <div className="menu">
      <div className="menu__bg" aria-hidden>
        <div className="menu__burst" />
        <div className="menu__radial" />
        <div className="halftone halftone--coarse" />
        <div className="speedlines" />
      </div>

      <div className="menu__cast" aria-hidden>
        {featured.map((hero, index) => (
          <div
            key={hero!.id}
            className="menu__castcard"
            style={
              {
                '--i': index,
                '--accent': hero!.accent,
                backgroundImage: `url(${hero!.artwork})`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <main className="menu__content">
        <div className="menu__logo">
          <span className="menu__logo-kicker">Heroes collide</span>
          <h1 className="menu__title">
            <span className="menu__title-super">SUPER</span>
            <span className="menu__title-clash">CLASH</span>
          </h1>
          <div className="menu__tagline">
            <span className="slash" />
            <p>A comic-book card battler</p>
            <span className="slash" />
          </div>
        </div>

        <nav className="menu__nav">
          <Button
            size="lg"
            slash
            icon={<Play size={22} fill="currentColor" />}
            onClick={onPlay}
            className="menu__play"
          >
            Play now
          </Button>
          <Button size="md" variant="secondary" icon={<Layers size={18} />} onClick={onCollection}>
            Collection
          </Button>
          <Button size="md" variant="secondary" icon={<BookOpen size={18} />} onClick={onHowTo}>
            How to play
          </Button>
          <Button size="md" variant="ghost" icon={<SettingsIcon size={18} />} onClick={onSettings}>
            Settings
          </Button>
        </nav>

        <dl className="menu__stats" aria-label="Career statistics">
          <div>
            <dt>Matches</dt>
            <dd>{stats.matches}</dd>
          </div>
          <div>
            <dt>Wins</dt>
            <dd>{stats.wins}</dd>
          </div>
          <div>
            <dt>
              <Trophy size={12} /> Streak
            </dt>
            <dd>{stats.bestStreak}</dd>
          </div>
          <div>
            <dt>
              <Swords size={12} /> Best hit
            </dt>
            <dd>{stats.bestHit}</dd>
          </div>
        </dl>
      </main>

      <footer className="menu__footer">
        <span>Simultaneous reveals · 16 heroes · 5 rounds</span>
        <span className="menu__footer-sep">◆</span>
        <span>Original characters &amp; art</span>
      </footer>
    </div>
  );
}
