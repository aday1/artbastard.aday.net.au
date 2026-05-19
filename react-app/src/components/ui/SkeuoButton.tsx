import React, { useState } from 'react';

export type SkeuoButtonAccent = 'cyan' | 'purple' | 'green' | 'neutral';

export interface SkeuoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'square' | 'pill' | 'wide';
  compact?: boolean;
  accent?: SkeuoButtonAccent;
}

export const SkeuoButton: React.FC<SkeuoButtonProps> = ({
  active = false,
  variant = 'square',
  compact = false,
  accent = 'cyan',
  className = '',
  children,
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...rest
}) => {
  const [pressed, setPressed] = useState(false);

  const classes = [
    'ab-skeuo-btn',
    variant === 'pill' ? 'ab-skeuo-btn--pill' : '',
    variant === 'wide' ? 'ab-skeuo-btn--wide' : '',
    compact ? 'ab-skeuo-btn--compact' : '',
    active ? 'ab-skeuo-btn--active' : '',
    accent === 'purple' ? 'ab-skeuo-btn--accent-purple' : '',
    accent === 'green' ? 'ab-skeuo-btn--accent-green' : '',
    pressed ? 'pressed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onPointerDown={(e) => {
        if (!disabled) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      {...rest}
    >
      <span className="ab-skeuo-btn__mask" aria-hidden>
        <span className="ab-skeuo-btn__inner" />
      </span>
      <span className="ab-skeuo-btn__light" aria-hidden />
      <span className="ab-skeuo-btn__ring" aria-hidden />
      <span className="ab-skeuo-btn__label">{children}</span>
    </button>
  );
};
