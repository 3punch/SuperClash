import { useState } from 'react';
import { AlertTriangle, Check, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { DIFFICULTIES } from '../game/data/meta';
import type { Settings, Stats } from '../game/storage';
import type { AIDifficulty } from '../game/types';
import { Button } from '../components/common/Buttons';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { sfx } from '../audio/sound';

const DIFFICULTY_ORDER: AIDifficulty[] = ['rookie', 'hero', 'legend'];

export function SettingsScreen({
  settings,
  stats,
  onChange,
  onBack,
  onResetStats,
  onResetAll,
}: {
  settings: Settings;
  stats: Stats;
  onChange: (patch: Partial<Settings>) => void;
  onBack: () => void;
  onResetStats: () => void;
  onResetAll: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

  return (
    <div className="screen screen--settings">
      <ScreenHeader title="Settings" subtitle="Audio, pacing and saved data" onBack={onBack} />

      <div className="settings">
        <section className="settings__block panel panel--ticked">
          <h2 className="settings__title">
            {settings.muted ? <VolumeX size={16} /> : <Volume2 size={16} />} Audio
          </h2>

          <label className="settings__toggle">
            <span>
              <strong>Mute everything</strong>
              <small>Silence music and all combat sounds</small>
            </span>
            <input
              type="checkbox"
              checked={settings.muted}
              onChange={(event) => onChange({ muted: event.target.checked })}
            />
            <i className="switch" aria-hidden />
          </label>

          <label className="settings__slider">
            <span>
              <strong>Music volume</strong>
              <small>{Math.round(settings.musicVolume * 100)}%</small>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.musicVolume * 100)}
              onChange={(event) => onChange({ musicVolume: Number(event.target.value) / 100 })}
              disabled={settings.muted}
            />
          </label>

          <label className="settings__slider">
            <span>
              <strong>Effects volume</strong>
              <small>{Math.round(settings.sfxVolume * 100)}%</small>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.sfxVolume * 100)}
              onChange={(event) => onChange({ sfxVolume: Number(event.target.value) / 100 })}
              disabled={settings.muted}
            />
          </label>

          <Button size="sm" variant="ghost" icon={<Volume2 size={14} />} onClick={() => sfx.impact()}>
            Test impact sound
          </Button>
        </section>

        <section className="settings__block panel panel--ticked">
          <h2 className="settings__title">Presentation</h2>

          <label className="settings__toggle">
            <span>
              <strong>Screen shake</strong>
              <small>Impact shake on heavy hits</small>
            </span>
            <input
              type="checkbox"
              checked={settings.screenShake}
              onChange={(event) => onChange({ screenShake: event.target.checked })}
            />
            <i className="switch" aria-hidden />
          </label>

          <label className="settings__toggle">
            <span>
              <strong>Reduced motion</strong>
              <small>Shorter animations, no shake, instant reveals</small>
            </span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => onChange({ reducedMotion: event.target.checked })}
            />
            <i className="switch" aria-hidden />
          </label>
        </section>

        <section className="settings__block panel panel--ticked">
          <h2 className="settings__title">Profile</h2>
          <label className="settings__input">
            <span>
              <strong>Challenger name</strong>
              <small>Shown during solo clashes</small>
            </span>
            <input
              type="text"
              maxLength={16}
              value={settings.playerName}
              onChange={(event) => onChange({ playerName: event.target.value.slice(0, 16) })}
              placeholder="Challenger"
            />
          </label>

          <div className="settings__levels" role="group" aria-label="Default A.I. difficulty">
            <span className="label">Default A.I. difficulty</span>
            <div className="settings__levelrow">
              {DIFFICULTY_ORDER.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`chip ${settings.difficulty === level ? 'is-active' : ''}`}
                  onClick={() => {
                    onChange({ difficulty: level });
                    sfx.tap();
                  }}
                >
                  {settings.difficulty === level ? <Check size={12} /> : null}
                  {DIFFICULTIES[level].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings__block panel panel--ticked">
          <h2 className="settings__title">Career record</h2>
          <dl className="settings__stats">
            <div><dt>Matches</dt><dd>{stats.matches}</dd></div>
            <div><dt>Wins</dt><dd>{stats.wins}</dd></div>
            <div><dt>Losses</dt><dd>{stats.losses}</dd></div>
            <div><dt>Draws</dt><dd>{stats.draws}</dd></div>
            <div><dt>Win rate</dt><dd>{winRate}%</dd></div>
            <div><dt>Best streak</dt><dd>{stats.bestStreak}</dd></div>
            <div><dt>Rounds played</dt><dd>{stats.roundsPlayed}</dd></div>
            <div><dt>Total damage</dt><dd>{stats.totalDamage}</dd></div>
          </dl>

          <div className="settings__danger">
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={onResetStats}>
              Reset statistics
            </Button>
            {confirmReset ? (
              <div className="settings__confirm">
                <span>
                  <AlertTriangle size={14} /> Erase decks, stats and settings?
                </span>
                <Button size="sm" variant="danger" onClick={onResetAll}>
                  Yes, erase everything
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" icon={<AlertTriangle size={14} />} onClick={() => setConfirmReset(true)}>
                Reset all data
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
