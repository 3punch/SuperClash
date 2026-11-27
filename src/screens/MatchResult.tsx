import { useEffect, useState } from 'react';
import { Home, Layers, RotateCcw, Swords, Trophy, Zap } from 'lucide-react';
import { requireHero } from '../game/data/heroes';
import { Button } from '../components/common/Buttons';
import type { MatchSummary } from '../App';

const CONFETTI = 26;

export function MatchResult({
  summary,
  onRematch,
  onMenu,
  onCollection,
  onDeck,
}: {
  summary: MatchSummary;
  onRematch: () => void;
  onMenu: () => void;
  onCollection: () => void;
  onDeck: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setRevealed(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  const draw = summary.winner === 'draw';
  const playerWon = summary.winner === 'p1';
  const tone = draw ? 'draw' : playerWon ? 'win' : 'lose';
  const title = draw ? 'DRAW' : playerWon ? 'VICTORY' : 'DEFEAT';
  const subtitle = draw
    ? 'Two titans, nothing between them.'
    : playerWon
      ? `${summary.p1Name} stands victorious.`
      : `${summary.p2Name} takes the clash.`;

  const mvp = [...summary.p1Deck]
    .map((id) => requireHero(id))
    .sort((a, b) => b.attack - a.attack)[0];

  return (
    <div className={`result result--${tone} ${revealed ? 'is-revealed' : ''}`}>
      <div className="result__bg" aria-hidden>
        <div className={`result__burst result__burst--${tone}`} />
        <div className="halftone halftone--coarse" />
        <div className="speedlines" />
      </div>

      {playerWon && !draw ? (
        <div className="result__confetti" aria-hidden>
          {Array.from({ length: CONFETTI }, (_, i) => (
            <i key={i} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
      ) : null}

      <div className="result__inner">
        <div className="result__badge">
          <Trophy size={18} />
          {summary.mode === 'ai' ? 'Solo clash' : 'Local duel'} · {summary.rounds} round{summary.rounds === 1 ? '' : 's'}
        </div>

        <h1 className="result__title">{title}</h1>
        <p className="result__subtitle">{subtitle}</p>

        <div className="result__score">
          <div className={`result__fighter ${playerWon && !draw ? 'is-winner' : ''}`}>
            <span className="result__initial">P1</span>
            <strong>{summary.p1Name}</strong>
            <span className="result__hp">{summary.p1Hp}</span>
            <small>HP</small>
          </div>
          <span className="result__dash">—</span>
          <div className={`result__fighter ${!playerWon && !draw ? 'is-winner' : ''}`}>
            <span className="result__initial">P2</span>
            <strong>{summary.p2Name}</strong>
            <span className="result__hp">{summary.p2Hp}</span>
            <small>HP</small>
          </div>
        </div>

        <dl className="result__stats">
          <div>
            <dt>
              <Swords size={13} /> Damage dealt
            </dt>
            <dd>{summary.damage}</dd>
          </div>
          <div>
            <dt>
              <Zap size={13} /> Best round
            </dt>
            <dd>{summary.bestHit}</dd>
          </div>
          <div>
            <dt>MVP</dt>
            <dd>{mvp ? mvp.name : '—'}</dd>
          </div>
          <div>
            <dt>Health left</dt>
            <dd>{summary.p1Hp}</dd>
          </div>
        </dl>

        <div className="result__actions">
          <Button size="lg" slash icon={<RotateCcw size={18} />} onClick={onRematch}>
            Rematch
          </Button>
          <Button size="md" variant="secondary" icon={<Layers size={16} />} onClick={onCollection}>
            Collection
          </Button>
          <Button size="md" variant="secondary" icon={<Swords size={16} />} onClick={onDeck}>
            New match
          </Button>
          <Button size="md" variant="ghost" icon={<Home size={16} />} onClick={onMenu}>
            Main menu
          </Button>
        </div>
      </div>
    </div>
  );
}
