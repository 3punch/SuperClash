export function RoundTracker({ round, maxRounds }: { round: number; maxRounds: number }) {
  return (
    <div className="tracker" aria-label={`Round ${round} of ${maxRounds}`}>
      <span className="tracker__label">
        Round <strong>{round}</strong>
        <small>/{maxRounds}</small>
      </span>
      <div className="tracker__pips">
        {Array.from({ length: maxRounds }, (_, i) => (
          <span
            key={i}
            className={[
              'tracker__pip',
              i + 1 < round ? 'is-done' : '',
              i + 1 === round ? 'is-current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
