import { Eye, Flame, Heart, Swords, Timer, Zap } from 'lucide-react';
import { ABILITIES } from '../game/data/abilities';
import { BALANCE } from '../game/balance';
import { HEROES } from '../game/data/heroes';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/common/Buttons';

const ABILITY_EXAMPLES = ['ignition', 'aegis', 'afterimage', 'riposte', 'bloodrage', 'refract'] as const;

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen screen--howto">
      <ScreenHeader
        title="How to play"
        subtitle="Five rounds. Hidden picks. One winner."
        onBack={onBack}
      />

      <div className="howto">
        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Timer size={17} /> The match
          </h2>
          <ol className="howto__steps">
            <li>
              <strong>Both fighters start at {BALANCE.maxHp} HP</strong> with an 8-card deck and a 3-card hand.
            </li>
            <li>
              <strong>Every round, both sides secretly pick one hero.</strong> Neither card is shown until both
              confirm — against the A.I. this happens simultaneously.
            </li>
            <li>
              <strong>The clash resolves automatically:</strong> abilities, speed, attack vs defence, damage,
              then status effects.
            </li>
            <li>
              <strong>Played cards are gone for the match.</strong> New cards are drawn each round.
            </li>
            <li>
              <strong>After {BALANCE.maxRounds} rounds, the fighter with more HP wins.</strong> Equal health is a draw.
              A knockout ends it instantly.
            </li>
          </ol>
        </section>

        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Swords size={17} /> The maths
          </h2>
          <div className="howto__formula">
            <code>damage = max(0, ATK + bonuses − DEF − bonuses)</code>
          </div>
          <ul className="howto__bullets">
            <li>
              <strong>A connecting hit always chips 1 HP</strong> — pure walls can&apos;t stalemate forever.
            </li>
            <li>
              <strong>Speed matters.</strong> A {BALANCE.speedEdgeThreshold}+ speed edge grants{' '}
              <em>+{BALANCE.speedBonus} initiative ATK</em>.
            </li>
            <li>
              <strong>Flat reductions still stop a hit.</strong> Aegis Plating, blocks and dodges can take damage to 0.
            </li>
            <li>
              <strong>Armour is not king.</strong> Blink Strike pierces DEF; Crushing Gravity grows with it.
            </li>
          </ul>
        </section>

        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Zap size={17} /> Energy
          </h2>
          <ul className="howto__bullets">
            <li>
              You start with <strong>{BALANCE.energyStart} energy</strong> and gain{' '}
              <strong>{BALANCE.energyPerRound} per round</strong>, capped at {BALANCE.energyMax}.
            </li>
            <li>
              Every card has a cost. If nothing in hand is affordable, the cheapest card <strong>plays free</strong>{' '}
              — a duel never stalls.
            </li>
            <li>
              Balance matters: a legal deck needs at least {BALANCE.minCheapCards} cards costing{' '}
              {BALANCE.cheapCost} or less.
            </li>
          </ul>
        </section>

        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Flame size={17} /> Abilities
          </h2>
          <p className="howto__copy">
            Every hero has one always-on rule with a clear trigger — no dice rolls decide a round. These are
            the signatures you&apos;ll face most:
          </p>
          <ul className="howto__abilities">
            {ABILITY_EXAMPLES.map((id) => {
              const ability = ABILITIES[id];
              return (
                <li key={id} style={{ '--accent': ability.color } as React.CSSProperties}>
                  <strong style={{ color: ability.color }}>{ability.name}</strong>
                  <span>{ability.rules}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Eye size={17} /> Local duel privacy
          </h2>
          <ul className="howto__bullets">
            <li>Player 1 picks, then the device shows a handoff screen. Player 1&apos;s card is never rendered.</li>
            <li>Player 2 picks on a clean board. Both cards flip together when the round commits.</li>
            <li>Use the Lock in button to confirm before the reveal.</li>
          </ul>
        </section>

        <section className="howto__block panel panel--ticked">
          <h2 className="howto__h2">
            <Heart size={17} /> The roster
          </h2>
          <p className="howto__copy">
            {HEROES.length} original heroes across five classes. Jump into the archive from the main menu to read
            every ability in full.
          </p>
          <Button size="md" onClick={onBack} slash>
            Back to the menu
          </Button>
        </section>
      </div>
    </div>
  );
}
