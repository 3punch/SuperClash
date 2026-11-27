import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadDecks,
  loadSettings,
  loadStats,
  loadUnlocks,
  saveDecks,
  saveSettings,
  saveStats,
  type SavedDecks,
  type Settings,
  type Stats,
} from './game/storage';
import { applyAudioSettings, startMusic, stopMusic, unlockAudio, sfx } from './audio/sound';
import { MainMenu } from './screens/MainMenu';
import { ModeSelect } from './screens/ModeSelect';
import { DeckSelect } from './screens/DeckSelect';
import { BattleScreen } from './screens/BattleScreen';
import { Collection } from './screens/Collection';
import { SettingsScreen } from './screens/SettingsScreen';
import { MatchResult } from './screens/MatchResult';
import { HowToPlay } from './screens/HowToPlay';
import { createMatch } from './game/engine';
import { DEFAULT_DECK } from './game/data/heroes';
import { recordMatch } from './game/storage';
import type { AIDifficulty, FighterState, MatchMode, MatchState, Side } from './game/types';

export type ScreenId =
  | 'menu'
  | 'modes'
  | 'deck'
  | 'battle'
  | 'collection'
  | 'settings'
  | 'howto'
  | 'result';

export interface MatchSummary {
  winner: Side | 'draw';
  mode: MatchMode;
  rounds: number;
  p1Hp: number;
  p2Hp: number;
  p1Name: string;
  p2Name: string;
  damage: number;
  bestHit: number;
  p1Deck: string[];
  matchId: string;
}

interface DeckDraft {
  mode: MatchMode;
  difficulty: AIDifficulty;
  playerDeck: string[];
  opponentDeck: string[];
  aiDeckPreview: string[];
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('menu');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [decks, setDecks] = useState<SavedDecks>(loadDecks);
  const [unlocks] = useState<string[]>(loadUnlocks);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [liveSummary, setLiveSummary] = useState<MatchSummary | null>(null);
  const [draft, setDraft] = useState<DeckDraft | null>(null);
  const recordedRef = useRef<string | null>(null);

  // Persist settings and keep the audio engine in sync.
  useEffect(() => {
    saveSettings(settings);
    applyAudioSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onFirstGesture = () => {
      unlockAudio();
      applyAudioSettings(settings);
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, [settings]);

  // Music only during menu-ish screens, to keep the arena dramatic.
  useEffect(() => {
    const wantsMusic = screen !== 'battle' && screen !== 'result';
    if (wantsMusic && !settings.muted) startMusic();
    else stopMusic();
  }, [screen, settings.muted]);

  useEffect(() => () => stopMusic(), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const go = useCallback((next: ScreenId) => {
    sfx.tap();
    setScreen(next);
  }, []);

  const startMatch = useCallback(
    (mode: MatchMode, difficulty: AIDifficulty, p1Deck: string[], p2Deck: string[]) => {
      const fresh = createMatch({
        mode,
        p1Name: settings.playerName || 'Challenger',
        p2Name: mode === 'ai' ? 'A.I. OPPONENT' : 'PLAYER 2',
        p1Deck: p1Deck.length ? p1Deck : DEFAULT_DECK,
        p2Deck: p2Deck.length ? p2Deck : DEFAULT_DECK,
        p2Difficulty: mode === 'ai' ? difficulty : null,
      });
      recordedRef.current = null;
      setLiveSummary(null);
      setDraft((prev) => ({ ...(prev ?? defaultDraft(difficulty)), mode, difficulty, playerDeck: p1Deck, opponentDeck: p2Deck }));
      setMatch(fresh);
      setScreen('battle');
    },
    [settings.playerName],
  );

  const beginModeSelect = useCallback(() => {
    sfx.tap();
    setScreen('modes');
  }, []);

  const chooseMode = useCallback(
    (mode: MatchMode, difficulty: AIDifficulty) => {
      const opponentDeck = mode === 'ai' ? aiDraftDeck() : decks.p2;
      setDraft({
        mode,
        difficulty,
        playerDeck: decks.p1,
        opponentDeck: mode === 'ai' ? opponentDeck : decks.p2,
        aiDeckPreview: opponentDeck,
      });
      sfx.tap();
      setScreen('deck');
    },
    [decks],
  );

  const confirmDecks = useCallback(
    (playerDeck: string[], opponentDeck: string[]) => {
      const next: SavedDecks = { p1: playerDeck, p2: opponentDeck };
      saveDecks(next);
      setDecks(next);
      const mode = draft?.mode ?? 'ai';
      const difficulty = draft?.difficulty ?? settings.difficulty;
      startMatch(mode, difficulty, playerDeck, opponentDeck);
    },
    [draft, settings.difficulty, startMatch],
  );

  // Finish a match exactly once, no matter how often React re-renders.
  const finishMatch = useCallback(
    (final: MatchState) => {
      const winner = final.winner;
      if (!winner) return;
      const result: 'win' | 'loss' | 'draw' =
        winner === 'draw' ? 'draw' : winner === 'p1' ? 'win' : 'loss';
      const p1: FighterState = final.fighters.p1;
      setLiveSummary({
        winner,
        mode: final.mode,
        rounds: final.round,
        p1Hp: p1.hp,
        p2Hp: final.fighters.p2.hp,
        p1Name: p1.name,
        p2Name: final.fighters.p2.name,
        damage: p1.damageDealt,
        bestHit: p1.bestHit,
        p1Deck: p1.deck,
        matchId: final.id,
      });
      if (recordedRef.current === final.id) return;
      recordedRef.current = final.id;
      setStats((prev) => {
        const next = recordMatch(prev, {
          result,
          mode: final.mode,
          rounds: final.round,
          damage: p1.damageDealt,
          bestHit: p1.bestHit,
          p1Deck: p1.deck,
        });
        saveStats(next);
        return next;
      });
      if (result === 'win') sfx.victory();
      else if (result === 'loss') sfx.defeat();
      setSummary({
        winner,
        mode: final.mode,
        rounds: final.round,
        p1Hp: p1.hp,
        p2Hp: final.fighters.p2.hp,
        p1Name: p1.name,
        p2Name: final.fighters.p2.name,
        damage: p1.damageDealt,
        bestHit: p1.bestHit,
        p1Deck: p1.deck,
        matchId: final.id,
      });
      setScreen('result');
    },
    [],
  );

  const rematch = useCallback(() => {
    if (!match) return;
    const mode = match.mode;
    const difficulty = match.fighters.p2.difficulty ?? settings.difficulty;
    startMatch(mode, difficulty, match.fighters.p1.deck, match.fighters.p2.deck);
  }, [match, settings.difficulty, startMatch]);

  const toMenu = useCallback(() => {
    setMatch(null);
    setSummary(null);
    setScreen('menu');
  }, []);

  const content = useMemo(() => {
    switch (screen) {
      case 'menu':
        return (
          <MainMenu
            stats={stats}
            onPlay={beginModeSelect}
            onCollection={() => go('collection')}
            onSettings={() => go('settings')}
            onHowTo={() => go('howto')}
          />
        );
      case 'modes':
        return (
          <ModeSelect
            difficulty={settings.difficulty}
            onBack={() => go('menu')}
            onChoose={chooseMode}
          />
        );
      case 'deck':
        return draft ? (
          <DeckSelect
            mode={draft.mode}
            difficulty={draft.difficulty}
            unlocks={unlocks}
            initialPlayerDeck={draft.playerDeck}
            initialOpponentDeck={draft.opponentDeck}
            onBack={() => go('modes')}
            onConfirm={confirmDecks}
          />
        ) : null;
      case 'battle':
        return match ? (
          <BattleScreen
            initial={match}
            settings={settings}
            onChange={setMatch}
            onFinish={finishMatch}
            onQuit={() => {
              setLiveSummary(null);
              go('menu');
            }}
          />
        ) : null;
      case 'result':
        return summary ? (
          <MatchResult
            summary={summary}
            onRematch={rematch}
            onMenu={toMenu}
            onCollection={() => go('collection')}
            onDeck={() => {
              setDraft((prev) => ({ ...(prev ?? defaultDraft(settings.difficulty)) }));
              setScreen('modes');
            }}
          />
        ) : null;
      case 'collection':
        return <Collection unlocks={unlocks} stats={stats} onBack={() => go('menu')} />;
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            stats={stats}
            onChange={updateSettings}
            onBack={() => go('menu')}
            onResetStats={() => {
              const cleared: Stats = {
                matches: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                roundsPlayed: 0,
                bestHit: 0,
                totalDamage: 0,
                bestStreak: 0,
                streak: 0,
                perHero: {},
              };
              setStats(cleared);
              saveStats(cleared);
            }}
            onResetAll={() => {
              try {
                localStorage.clear();
              } catch {
                /* ignore */
              }
              setDecks({ p1: DEFAULT_DECK, p2: DEFAULT_DECK });
              setSettings(loadSettings());
              setStats(loadStats());
            }}
          />
        );
      case 'howto':
        return <HowToPlay onBack={() => go('menu')} />;
      default:
        return null;
    }
  }, [
    screen,
    stats,
    beginModeSelect,
    go,
    settings,
    chooseMode,
    draft,
    unlocks,
    confirmDecks,
    match,
    finishMatch,
    summary,
    rematch,
    toMenu,
    updateSettings,
    decks,
  ]);

  return (
    <div className="app" data-screen={screen}>
      {content}
      {liveSummary && screen !== 'result' ? (
        <div className="toast" role="status">
          Match over — {liveSummary.p1Name} {liveSummary.p1Hp} : {liveSummary.p2Hp} {liveSummary.p2Name}
        </div>
      ) : null}
    </div>
  );
}

function defaultDraft(difficulty: AIDifficulty): DeckDraft {
  return {
    mode: 'ai',
    difficulty,
    playerDeck: DEFAULT_DECK,
    opponentDeck: DEFAULT_DECK,
    aiDeckPreview: DEFAULT_DECK,
  };
}

/** The AI brings a varied but legal deck. */
function aiDraftDeck(): string[] {
  const pools = [
    ['kairo', 'voltrex', 'echo', 'sentinel', 'ironclad', 'ravager', 'pyroclast', 'prism'],
    ['voltrex', 'kairo', 'echo', 'ravager', 'bulwark', 'oracle', 'pyroclast', 'ironclad'],
    ['kairo', 'echo', 'voltrex', 'ironclad', 'bulwark', 'mammoth', 'gravlord', 'thornwild'],
    ['sentinel', 'echo', 'kairo', 'voltrex', 'oracle', 'shiv', 'zephyra', 'prism'],
    ['ravager', 'kairo', 'voltrex', 'sentinel', 'echo', 'pyroclast', 'arcwraith', 'ironclad'],
  ];
  return pools[Math.floor(Math.random() * pools.length)];
}
