import React from 'react';

export type RackLedState = 'off' | 'on' | 'armed' | 'clip';

export interface RackLedProps {
  state?: RackLedState;
  title?: string;
  className?: string;
}

export const RackLed: React.FC<RackLedProps> = ({
  state = 'off',
  title,
  className = '',
}) => (
  <span
    className={[
      'ab-rack-led',
      state !== 'off' ? `ab-rack-led--${state}` : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    title={title}
    role="img"
    aria-label={title ?? state}
  />
);

export interface RackLedStripProps {
  count?: number;
  value: number;
  max?: number;
  className?: string;
}

export const RackLedStrip: React.FC<RackLedStripProps> = ({
  count = 10,
  value,
  max = 255,
  className = '',
}) => {
  const lit = Math.round((value / max) * count);
  return (
    <span className={`ab-rack-led-strip ${className}`.trim()} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <RackLed key={i} state={i < lit ? 'on' : 'off'} />
      ))}
    </span>
  );
};
