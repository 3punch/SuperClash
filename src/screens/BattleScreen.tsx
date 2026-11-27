import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Eye, EyeOff, Lock, ListOrdered, ShieldQuestion, Sparkles, X } from 'lucide-react';
import { BALANCE } from '../game/balance';
import { CLASSES, DIFFICULTIES } from '../game/data/meta';
import { requireHero } from '../game/data/heroes';
import { chooseAICard } from '../game/ai';
import {
  advanceRound,
  beginHandoff,
  canPlay,
  commitRound,
  handoffToP2,
  publicView,
  selectCard,
  selectWithAI,
} from '../game/engine';
import type { HeroCard, MatchState, Side } from '../game/types';
import type { Settings } from '../game/storage';
import { HeroCard as HeroCardView } from '../components/cards/HeroCard';
import { CardDetail } from '../components/cards/CardDetail';
import { HeroArt } from '../components/cards/HeroArt';
import { HealthBar } from '../components/battle/HealthBar';
import { CombatLog } from '../components/battle/CombatLog';
import { RoundTracker } from '../components/battle/RoundTracker';
import { Button } from '../components/common/Buttons';
import { EnergyCost } from '../components/cards/Stats';
import { sfx } from '../audio/sound';

type Stage = 'pick' | 'handoff' | 'clash' | 'resolve';

interface ImpactFx {
  side: Side;
  amount: number;
  key: number;
  kind: 'hit' | 'burn' | 'heal' | 'dodge' | 'block';
}

export function BattleScreen({
  initial,
  settings,
  onChange,
  onFinish,
  onQuit,
}: {
  initial: MatchState;
  settings: Settings;
  onChange: (state: MatchState) => void;
  onFinish: (state: MatchState) => void;
  onQuit: () => void;
}) {
  const [state, setState] = useState<MatchState>(initial);
  const [stage, setStage] = useState<Stage>('pick');
  const [activeSide, setActiveSide] = useState<Side>('p1');
  const [inspect, setInspect] = useState<HeroCard | null>(null);
  const [fx, setFx] = useState<ImpactFx | null>(null);
  const [shake, setShake] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const timers = useRef<number[]>([]);

  const viewer: Side = state.mode === 'ai' ? 'p1' : activeSide;
  const view = useMemo(() => publicView(state, viewer), [state, viewer]);
  const result = state.lastResult;
  const reduced = settings.reducedMotion;

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const after = useCallback(
    (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, reduced ? Math.min(ms, 40) : ms);
      timers.current.push(id);
    },
    [reduced],
  );

  useEffect(() => clearTimers, [clearTimers]);

  const push = useCallback(
    (next: MatchState) => {
      setState(next);
      onChange(next);
    },
    [onChange],
  );

  const triggerShake = useCallback(() => {
    if (!settings.screenShake || reduced) return;
    setShake(true);
    after(300, () => setShake(false));
  }, [after, reduced, settings.screenShake]);

  const flash = useCallback((payload: ImpactFx) => {
    setFx(payload);
    window.setTimeout(
      () => setFx((current) => (current && current.key === payload.key ? null : current)),
      900,
    );
  }, []);

  // ── Selection ────────────────────────────────────────────────────────────

  const handlePick = useCallback(
    (card: HeroCard) => {
      if (stage !== 'pick') return;
      const side = state.mode === 'ai' ? 'p1' : activeSide;
      if (!canPlay(state.fighters[side], card.id).ok) {
        sfx.error();
        return;
      }
      sfx.select();
      const picked = selectCard(state, side, card.id);
      if (picked === state) {
        sfx.error();
        return;
      }

      if (state.mode === 'ai') {
        setStage('clash');
        push(picked);
        const ai = chooseAICard(picked, 'p2', picked.fighters.p2.difficulty ?? 'hero');
        setAiTip(ai.rationale);
        after(reduced ? 140 : 660, () => {
          let withAi = selectWithAI(picked, ai.cardId);
          if (withAi === picked) {
            const fallback = picked.fighters.p2.hand.find((id) => canPlay(picked.fighters.p2, id).ok);
            if (!fallback) return;
            withAi = selectWithAI(picked, fallback);
          }
          push(commitRound(withAi));
        });
        return;
      }

      if (activeSide === 'p1') {
        // P1's pick is confirmed: seal the device before P2 may look.
        push(beginHandoff(picked));
        setStage('handoff');
      } else {
        // P2's pick stays on the board until they explicitly lock in.
        push(picked);
      }
    },
    [activeSide, after, push, reduced, stage, state],
  );

  const handoffContinue = useCallback(() => {
    sfx.lock();
    push(handoffToP2(state));
    setActiveSide('p2');
    setStage('pick');
  }, [push, state]);

  const commitLocal = useCallback(() => {
    const committed = commitRound(state);
    if (committed === state) {
      sfx.error();
      return;
    }
    sfx.lock();
    push(committed);
    setStage('clash');
  }, [push, state]);

  // ── Reveal choreography ──────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'reveal' || !state.lastResult) return;
    const outcome = state.lastResult;
    setStage('clash');
    sfx.reveal();
    let delay = reduced ? 60 : 760;

    after(delay, () => {
      const biggest = [
        { side: 'p1' as Side, amount: outcome.p1.clashDamage },
        { side: 'p2' as Side, amount: outcome.p2.clashDamage },
      ].sort((a, b) => b.amount - a.amount)[0];
      if (biggest.amount > 0) {
        flash({ ...biggest, key: Date.now(), kind: 'hit' });
        sfx.impact();
        if (biggest.amount >= 5) triggerShake();
      }
      const blocker: Side | null = outcome.p1.blocked ? 'p1' : outcome.p2.blocked ? 'p2' : null;
      if (blocker) {
        flash({ side: blocker, amount: 0, key: Date.now() + 1, kind: 'block' });
        sfx.block();
      }
      const dodger: Side | null = outcome.p1.dodged ? 'p1' : outcome.p2.dodged ? 'p2' : null;
      if (dodger) {
        flash({ side: dodger, amount: 0, key: Date.now() + 2, kind: 'dodge' });
        sfx.ability();
      }
    });

    delay += reduced ? 40 : 640;

    if (outcome.p1.burned > 0 || outcome.p2.burned > 0) {
      after(delay, () => {
        const side: Side = outcome.p1.burned > 0 ? 'p1' : 'p2';
        flash({ side, amount: outcome.p1.burned || outcome.p2.burned, key: Date.now(), kind: 'burn' });
        sfx.burn();
      });
      delay += reduced ? 40 : 460;
    }

    if (outcome.p1.healed > 0 || outcome.p2.healed > 0) {
      after(delay, () => {
        const side: Side = outcome.p1.healed > 0 ? 'p1' : 'p2';
        flash({ side, amount: outcome.p1.healed || outcome.p2.healed, key: Date.now(), kind: 'heal' });
        sfx.heal();
      });
      delay += reduced ? 40 : 420;
    }

    after(delay, () => {
      setShowExplain(true);
      setStage('resolve');
    });
  }, [after, flash, reduced, state.phase, state.lastResult, triggerShake]);

  // ── Round progression ────────────────────────────────────────────────────

  const continueRound = useCallback(() => {
    setShowExplain(false);
    setAiTip(null);
    const next = advanceRound(state);
    push(next);
    if (next.phase === 'match-end') {
      onFinish(next);
      return;
    }
    setActiveSide('p1');
    setStage('pick');
    sfx.tap();
  }, [onFinish, push, state]);

  const skipReveal = useCallback(() => {
    if (!state.lastResult) return;
    clearTimers();
    setShowExplain(true);
    setStage('resolve');
  }, [clearTimers, state.lastResult]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const p1 = state.fighters.p1;
  const p2 = state.fighters.p2;
  const turnSide: Side = state.mode === 'ai' ? 'p1' : activeSide;
  const fighter = state.fighters[turnSide];
  const hand = fighter.hand;
  const revealed = stage === 'clash' || stage === 'resolve';
  const shownP1Card = revealed && result ? requireHero(result.p1.cardId) : null;
  const shownP2Card = revealed && result ? requireHero(result.p2.cardId) : null;
  const ownPending = state.mode === 'ai' ? view.ownPick : state.pending[turnSide];

  /**
   * P1's committed-but-unrevealed card.
   * In solo play the human may see their own locked choice. In a local duel
   * the board is shared, so once the handoff starts nothing of P1's card may
   * render — only its sealed state is public.
   */
  const p1PendingId = state.mode === 'ai' ? view.ownPick : state.pending.p1;
  const p1Committed = p1PendingId ? requireHero(p1PendingId) : null;
  const p1MaySeeOwnCard = state.mode === 'ai';
  const foeSide: Side = turnSide === 'p1' ? 'p2' : 'p1';
  const opponentPending = state.mode === 'ai' ? null : state.pending[foeSide];
  const opponentReady = state.mode === 'ai' ? false : opponentPending !== null;
  /** Cards still in the draw pile (the hand is already on screen). */
  const cardsToDraw = (side: Side) => state.fighters[side].drawPile.length;
  const matchOver = state.phase === 'match-end';

  const actionLabel = (): string => {
    if (!result) return 'Next round';
    if (result.hpAfter.p1 === 0 || result.hpAfter.p2 === 0) return 'See result';
    if (state.round >= state.maxRounds) return 'See result';
    return 'Next round';
  };

  return (
    <div
      className={[
        'battle',
        shake ? 'is-shaking' : '',
        stage === 'clash' ? 'is-clashing' : '',
        showExplain ? 'is-resolving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-stage={stage}
    >
      <div className="battle__bg" aria-hidden>
        <div className="battle__arena-bg" />
        <div className="battle__glow battle__glow--p1" />
        <div className="battle__glow battle__glow--p2" />
        <div className="halftone halftone--coarse" />
        {stage === 'clash' ? <div className="battle__speedlines" /> : null}
      </div>

      {/* Top bar */}
      <header className="battle__top">
        <div className="battle__topgroup">
          <button type="button" className="battle__iconbtn" onClick={onQuit} aria-label="Quit match">
            <X size={17} />
          </button>
          <button
            type="button"
            className={`battle__iconbtn ${showLog ? 'is-on' : ''}`}
            onClick={() => setShowLog((v) => !v)}
            aria-label="Toggle combat log"
            aria-pressed={showLog}
          >
            <ListOrdered size={17} />
          </button>
        </div>
        <RoundTracker round={state.round} maxRounds={state.maxRounds} />
        <div className="battle__topgroup battle__topgroup--right">
          {state.mode === 'ai' ? (
            <button
              type="button"
              className={`battle__aibtn ${showAiPanel ? 'is-on' : ''}`}
              onClick={() => setShowAiPanel((v) => !v)}
              aria-pressed={showAiPanel}
            >
              {showAiPanel ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{DIFFICULTIES[p2.difficulty ?? 'hero'].label}</span>
            </button>
          ) : (
            <span className="battle__turnchip">P{activeSide === 'p1' ? '1' : '2'} TURN</span>
          )}
        </div>
      </header>

      {/* Arena */}
      <div className="battle__banner" role="status">
        <span className="battle__bannerround">ROUND {state.round}</span>
        <span className="battle__bannerdot" aria-hidden>
          ◆
        </span>
        <span className="battle__bannerphase">
          {stage === 'handoff'
            ? 'Passing the device'
            : stage === 'clash'
              ? 'Clash resolving'
              : stage === 'resolve'
                ? 'Round complete'
                : state.mode === 'ai'
                  ? 'Choose your hero in secret'
                  : `Player ${activeSide === 'p1' ? '1' : '2'} — choose in secret`}
        </span>
      </div>

      <section className="battle__field" aria-label="Battle arena">
        <div className="battle__side battle__side--p1">
          <HealthBar hp={p1.hp} name={p1.name} label="P1" side="p1" burn={p1.burn} active={turnSide === 'p1'} />
          <div className="battle__slots">
            <div
              className={`slotcard ${shownP1Card ? 'is-revealed' : ''} ${
                p1Committed && !revealed ? 'is-locked' : ''
              }`}
              data-committed={p1Committed ? p1Committed.id : undefined}
            >
              {shownP1Card ? (
                <HeroCardView card={shownP1Card} size="md" showAbility={false} />
              ) : p1Committed && p1MaySeeOwnCard ? (
                <HeroCardView card={p1Committed} size="md" showAbility={false} badge="LOCKED IN" />
              ) : p1Committed ? (
                // Local duel, waiting for P2: never render the card face.
                <div className="slotcard__sealed">
                  <Lock size={24} />
                  <span>Sealed</span>
                  <small>Hidden from Player 2</small>
                </div>
              ) : (
                <div className="slotcard__empty">
                  <ShieldQuestion size={26} />
                  <span>Choose a hero</span>
                </div>
              )}
            </div>
            <EnergyMeter value={p1.energy} align="left" />
          </div>
        </div>

        <div className="battle__center">
          {stage === 'clash' || stage === 'resolve' ? (
            <div className="clash">
              <span className="clash__flash" aria-hidden />
              <span className="clash__vs">VS</span>
              {result ? (
                <span className={`clash__headline clash__headline--${result.roundWinner ?? 'draw'}`}>
                  {result.headline}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="idle">
              <span className="idle__ring" aria-hidden />
              <span className="idle__vs" aria-hidden>
                VS
              </span>
              <span className="idle__caption">
                {stage === 'handoff' ? 'Pass device' : 'Pick a hero'}
              </span>
            </div>
          )}
          {fx ? (
            <span className={`dmg dmg--${fx.kind} dmg--${fx.side}`} key={fx.key} aria-live="polite">
              {fx.kind === 'block'
                ? 'BLOCKED'
                : fx.kind === 'dodge'
                  ? 'MISS'
                  : fx.kind === 'heal'
                    ? `+${fx.amount}`
                    : `−${fx.amount}`}
            </span>
          ) : null}
          {stage === 'clash' && state.mode === 'ai' && !revealed ? (
            <span className="battle__thinking">A.I. is choosing…</span>
          ) : null}
          {showExplain && result ? (
            <div className="roundwin" aria-live="polite">
              <span className={`roundwin__badge roundwin__badge--${result.roundWinner ?? 'draw'}`}>
                {result.roundWinner === null
                  ? 'DRAW ROUND'
                  : result.roundWinner === 'p1'
                    ? state.mode === 'local' ? 'P1 TAKES IT' : 'ROUND WON'
                    : state.mode === 'local' ? 'P2 TAKES IT' : 'ROUND LOST'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="battle__side battle__side--p2">
          <HealthBar hp={p2.hp} name={p2.name} label="P2" side="p2" burn={p2.burn} active={turnSide === 'p2'} />
          <div className="battle__slots battle__slots--right">
            <div className={`slotcard ${shownP2Card ? 'is-revealed' : ''} ${opponentReady && !revealed ? 'is-locked' : ''}`}>
              {shownP2Card ? (
                <HeroCardView card={shownP2Card} size="md" showAbility={false} />
              ) : opponentReady ? (
                <div className="slotcard__hidden">
                  <Lock size={24} />
                  <span>Card locked</span>
                </div>
              ) : (
                <div className="slotcard__empty slotcard__empty--opponent">
                  <ShieldQuestion size={26} />
                  <span>{state.mode === 'ai' ? 'A.I. ready' : 'Waiting'}</span>
                </div>
              )}
            </div>
            <EnergyMeter value={p2.energy} align="right" />
          </div>
        </div>
      </section>

      {/* Handoff overlay */}
      {stage === 'handoff' ? (
        <div className="handoff" role="dialog" aria-modal="true" aria-label="Pass the device to player 2">
          <div className="handoff__panel">
            <span className="handoff__icon">
              <EyeOff size={32} />
            </span>
            <h2 className="handoff__title">Pass the device</h2>
            <p className="handoff__copy">
              Player 1&apos;s hero is locked and hidden. Hand the device to <strong>Player 2</strong> — no
              peeking.
            </p>
            <div className="handoff__hidden">
              <Lock size={13} /> P1 CARD SEALED
            </div>
            <Button size="lg" full slash onClick={handoffContinue} icon={<ChevronRight size={18} />}>
              I&apos;m Player 2 — continue
            </Button>
          </div>
        </div>
      ) : null}

      {/* Dock: hand while picking, breakdown while resolving */}
      <section className="battle__dock" aria-label={showExplain ? 'Round breakdown' : 'Your hand'}>
        {showExplain && result ? (
          <RoundBreakdown
            result={result}
            state={state}
            onNext={continueRound}
            label={actionLabel()}
            isLast={matchOver}
          />
        ) : (
          <>
            <div className="battle__handhead">
              <div className="battle__handinfo">
                {state.mode === 'local' ? (
                  <span className="battle__pchip">
                    <i className={`battle__pdot battle__pdot--${activeSide}`} />
                    Player {activeSide === 'p1' ? '1' : '2'}
                  </span>
                ) : (
                  <EnergyCost cost={0} free={false} />
                )}
                <span className="battle__handlabel">
                  {hand.length} in hand · {cardsToDraw(turnSide)} to draw
                </span>
              </div>
              <div className="battle__handactions">
                {stage === 'clash' ? (
                  <Button size="sm" variant="ghost" onClick={skipReveal}>
                    Skip
                  </Button>
                ) : state.mode === 'local' && activeSide === 'p2' && state.pending.p2 ? (
                  <Button size="sm" slash onClick={commitLocal} icon={<Lock size={14} />}>
                    Lock in
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="battle__hand">
              {hand.map((id, index) => {
                const card = requireHero(id);
                const playability = canPlay(fighter, id);
                const blocked = !playability.ok || stage !== 'pick';
                return (
                  <div
                    key={id}
                    className={`battle__handslot ${blocked ? 'is-blocked' : ''}`}
                    style={{ '--i': index } as React.CSSProperties}
                  >
                    <HeroCardView
                      card={card}
                      size="md"
                      hand
                      selected={ownPending === id}
                      disabled={blocked}
                      dimmed={!playability.ok}
                      freePlay={playability.freePlay}
                      onClick={handlePick}
                      onInspect={setInspect}
                    />
                    {!playability.ok && playability.reason ? (
                      <span className="battle__reason">{playability.reason}</span>
                    ) : null}
                  </div>
                );
              })}
              {hand.length === 0 ? <p className="battle__noCards">No cards left in hand.</p> : null}
            </div>
          </>
        )}
      </section>

      {/* Combat log drawer */}
      {showLog ? (
        <div className="logdrawer">
          <CombatLog entries={state.log} />
        </div>
      ) : null}

      {/* AI insight drawer */}
      {showAiPanel ? (
        <aside className="aipanel">
          <div className="aipanel__head">
            <span className="label">A.I. insight</span>
            <span className="pill">{DIFFICULTIES[p2.difficulty ?? 'hero'].label}</span>
          </div>
          <p className="aipanel__tip">
            {aiTip ?? 'The A.I. picks at the same moment you do — neither side sees the other.'}
          </p>
          <div className="aipanel__history">
            <span className="label">Revealed picks</span>
            <div className="aipanel__row">
              {p2.cardHistory.length === 0 ? (
                <em>Nothing revealed yet.</em>
              ) : (
                p2.cardHistory.map((id, index) => {
                  const hero = requireHero(id);
                  return (
                    <span key={`${id}-${index}`} className="aipanel__chip" style={{ borderColor: hero.accent }}>
                      {hero.name}
                    </span>
                  );
                })
              )}
            </div>
          </div>
          <ul className="aipanel__facts">
            <li>Cards in hand: {p2.hand.length}</li>
            <li>Energy: {p2.energy}</li>
            <li>
              Classes played:{' '}
              {p2.classHistory.length === 0
                ? '—'
                : Array.from(new Set(p2.classHistory))
                    .map((cls) => CLASSES[cls].label)
                    .join(', ')}
            </li>
          </ul>
        </aside>
      ) : null}

      {inspect ? <CardDetail card={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}

function EnergyMeter({ value, align }: { value: number; align: 'left' | 'right' }) {
  return (
    <div className={`battle__energy battle__energy--${align}`}>
      {align === 'right' ? (
        <>
          <span className="battle__energyval">
            <Sparkles size={11} /> {value}
          </span>
          {Array.from({ length: BALANCE.energyMax }, (_, i) => (
            <i key={i} className={i < value ? 'is-full' : ''} />
          ))}
        </>
      ) : (
        <>
          {Array.from({ length: BALANCE.energyMax }, (_, i) => (
            <i key={i} className={i < value ? 'is-full' : ''} />
          ))}
          <span className="battle__energyval">
            <Sparkles size={11} /> {value}
          </span>
        </>
      )}
    </div>
  );
}

function RoundBreakdown({
  result,
  state,
  onNext,
  label,
  isLast,
}: {
  result: NonNullable<MatchState['lastResult']>;
  state: MatchState;
  onNext: () => void;
  label: string;
  isLast: boolean;
}) {
  return (
    <div className="breakdown">
      <div className="breakdown__head">
        <span className="caption">Round {result.round} breakdown</span>
        <div className="breakdown__actions">
          <span className="breakdown__hp">
            P1 {result.hpBefore.p1}→{result.hpAfter.p1}
            <span aria-hidden> · </span>
            P2 {result.hpBefore.p2}→{result.hpAfter.p2}
          </span>
          <Button size="sm" slash onClick={onNext} icon={<ChevronRight size={14} />}>
            {label}
          </Button>
        </div>
      </div>

      <div className="breakdown__body">
        <div className="breakdown__sides">
          {(['p1', 'p2'] as Side[]).map((side) => {
            const outcome = result[side];
            const card = requireHero(outcome.cardId);
            return (
              <div key={side} className={`breakdown__side breakdown__side--${side}`}>
                <div className="breakdown__cardline">
                  <HeroArt card={card} />
                  <div className="breakdown__cardmeta">
                    <strong>{outcome.cardName}</strong>
                    <span>{CLASSES[card.class].label}</span>
                  </div>
                  <span className="breakdown__dealt">{outcome.damageDealt}</span>
                </div>
                <div className="breakdown__math">
                  <span>ATK {outcome.effectiveAttack}</span>
                  <span>DEF {outcome.effectiveDefense}</span>
                  <span className={outcome.clashDamage > 0 ? 'ok' : 'muted'}>
                    {outcome.clashDamage > 0 ? `${outcome.clashDamage} through` : 'Blocked'}
                  </span>
                </div>
                {outcome.attackBonuses.length > 0 ? (
                  <div className="breakdown__bonus">
                    {outcome.attackBonuses.map((bonus) => (
                      <span key={bonus.label}>
                        {bonus.label} +{bonus.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <ul className="breakdown__lines">
          {result.explanation.slice(0, 4).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>

      {isLast ? (
        <p className="breakdown__last">
          Final round complete — {state.fighters.p1.name} {result.hpAfter.p1} : {result.hpAfter.p2}{' '}
          {state.fighters.p2.name}
        </p>
      ) : null}
    </div>
  );
}
