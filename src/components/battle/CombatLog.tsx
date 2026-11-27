import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../game/types';

export function CombatLog({ entries, compact }: { entries: LogEntry[]; compact?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [entries.length]);

  return (
    <div className={`log ${compact ? 'log--compact' : ''}`}>
      <div className="log__head">
        <span className="label">Combat log</span>
        <span className="log__count">{entries.length}</span>
      </div>
      <ol className="log__list">
        {entries.map((entry, index) => (
          <li key={`${entry.round}-${index}`} className={`log__item log__item--${entry.tone}`}>
            <span className="log__round">R{entry.round}</span>
            <span className="log__text">{entry.text}</span>
          </li>
        ))}
        <div ref={endRef} />
      </ol>
    </div>
  );
}
