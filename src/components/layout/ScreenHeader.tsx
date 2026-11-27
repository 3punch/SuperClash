import { ChevronLeft } from 'lucide-react';
import { sfx } from '../../audio/sound';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button
          type="button"
          className="screen-header__back"
          onClick={() => {
            sfx.tap();
            onBack();
          }}
          aria-label="Go back"
        >
          <ChevronLeft size={20} strokeWidth={2.6} />
          <span>Back</span>
        </button>
      ) : (
        <span className="screen-header__spacer" />
      )}
      <div className="screen-header__titles">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="screen-header__right">{right}</div>
    </header>
  );
}
