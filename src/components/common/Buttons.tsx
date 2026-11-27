import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sfx } from '../../audio/sound';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  full?: boolean;
  /** Skewed comic lettering, used for hero CTAs. */
  slash?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  full,
  slash,
  children,
  className = '',
  onClick,
  ...rest
}: ButtonProps) {
  const handle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!rest.disabled) sfx.tap();
    onClick?.(event);
  };
  return (
    <button
      type="button"
      {...rest}
      onClick={handle}
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        full ? 'btn--full' : '',
        slash ? 'btn--slash' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span className="btn__label">{children}</span>
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = '', onClick, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      onClick={(event) => {
        sfx.tap();
        onClick?.(event);
      }}
      className={`icon-btn ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="ghost" size="sm" icon={<span aria-hidden>←</span>} onClick={onClick} className="back-btn">
      {label}
    </Button>
  );
}
