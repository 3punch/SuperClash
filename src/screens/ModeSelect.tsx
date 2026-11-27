import { Bot, Check, Smartphone, Sparkles, Users } from 'lucide-react';
import { DIFFICULTIES } from '../game/data/meta';
import type { AIDifficulty, MatchMode } from '../game/types';
import { BackButton, Button } from '../components/common/Buttons';
import { ScreenHeader } from '../components/layout/ScreenHeader';

const DIFFICULTY_ORDER: AIDifficulty[] = ['rookie', 'hero', 'legend'];

export function ModeSelect({
  difficulty,
  onBack,
  onChoose,
}: {
  difficulty: AIDifficulty;
  onBack: () => void;
  onChoose: (mode: MatchMode, difficulty: AIDifficulty) => void;
}) {
  return (
    <div className="screen screen--modes">
      <ScreenHeader title="Choose your battle" subtitle="Two fighters. Twenty health. Five rounds." onBack={onBack} />

      <div className="modes">
        <article className="mode-card mode-card--ai">
          <div className="mode-card__glow" aria-hidden />
          <header className="mode-card__head">
            <span className="mode-card__icon">
              <Bot size={26} />
            </span>
            <div>
              <h2>Solo Clash</h2>
              <p>Face an adaptive A.I. that reads your patterns.</p>
            </div>
          </header>

          <div className="mode-card__difficulty">
            <span className="label">Difficulty</span>
            <div className="mode-card__levels" role="group" aria-label="Difficulty">
              {DIFFICULTY_ORDER.map((level) => {
                const meta = DIFFICULTIES[level];
                const active = level === difficulty;
                return (
                  <button
                    key={level}
                    type="button"
                    className={`level ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => onChoose('ai', level)}
                  >
                    <span className="level__stars" aria-hidden>
                      {'★'.repeat(meta.stars)}
                      <span className="level__dim">{'★'.repeat(3 - meta.stars)}</span>
                    </span>
                    <span className="level__name">{meta.label}</span>
                    <span className="level__blurb">{meta.blurb}</span>
                    {active ? (
                      <span className="level__check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mode-card__hint">
              <Sparkles size={13} /> Default difficulty is set in Settings — pick one here to jump straight in.
            </p>
          </div>

          <Button
            size="lg"
            full
            slash
            icon={<Bot size={18} />}
            onClick={() => onChoose('ai', difficulty)}
            className="mode-card__cta"
          >
            Fight the A.I.
          </Button>
        </article>

        <article className="mode-card mode-card--local">
          <div className="mode-card__glow" aria-hidden />
          <header className="mode-card__head">
            <span className="mode-card__icon">
              <Users size={26} />
            </span>
            <div>
              <h2>Local Duel</h2>
              <p>Two players, one device. Selections stay secret.</p>
            </div>
          </header>

          <ul className="mode-card__rules">
            <li>
              <Smartphone size={15} /> Player 1 picks in private, then passes the device.
            </li>
            <li>
              <Check size={15} /> A handoff screen hides P1&apos;s card from Player 2.
            </li>
            <li>
              <Check size={15} /> Both cards flip at the same moment — no peeking.
            </li>
          </ul>

          <Button
            size="lg"
            full
            slash
            variant="danger"
            icon={<Users size={18} />}
            onClick={() => onChoose('local', difficulty)}
            className="mode-card__cta"
          >
            Pass &amp; Play
          </Button>
        </article>
      </div>

      <div className="screen__foot">
        <BackButton onClick={onBack} label="Main menu" />
      </div>
    </div>
  );
}
