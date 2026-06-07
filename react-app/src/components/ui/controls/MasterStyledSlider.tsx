import React, { useEffect, useId, useMemo, useRef } from 'react';
import { useRangeTouchGuard } from './useRangeTouchGuard';
import styles from './MasterStyledSlider.module.scss';

export interface MasterStyledSliderTick {
  value: number;
  label?: string;
  min?: number;
  max?: number;
}

export interface MasterStyledSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  vertical?: boolean;
  onChange: (value: number) => void;
  onInput?: (value: number) => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  className?: string;
  height?: number;
  ticks?: MasterStyledSliderTick[];
  showTickLabels?: boolean;
}

export const MasterStyledSlider: React.FC<MasterStyledSliderProps> = ({
  value,
  min = 0,
  max = 255,
  step = 1,
  disabled = false,
  vertical = false,
  onChange,
  onInput,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  className = '',
  height = 280,
  ticks = [],
  showTickLabels = false,
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const ticksId = useId();
  const touchGuard = useRangeTouchGuard(disabled);
  const normalizedTicks = useMemo(
    () =>
      ticks
        .filter((tick) => Number.isFinite(tick.value))
        .map((tick) => {
          const clamped = Math.max(min, Math.min(max, tick.value));
          const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
          return { ...tick, value: clamped, pct };
        }),
    [ticks, min, max]
  );

  useEffect(() => {
    formRef.current?.style.setProperty('--val', String(value));
    formRef.current?.style.setProperty('--min', String(min));
    formRef.current?.style.setProperty('--max', String(max));
  }, [value, min, max]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    formRef.current?.style.setProperty('--val', String(v));
    onInput?.(v);
    onChange(v);
  };

  const rangeClass = [
    'ab-dmx-range',
    vertical ? 'ab-dmx-range--vertical ab-styled-fader' : 'ab-dmx-range--horizontal',
  ]
    .filter(Boolean)
    .join(' ');

  const rangeInput = (
    <input
      ref={touchGuard.inputRef}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      list={ticksId}
      className={`${styles.input} ${rangeClass}`}
      onChange={handle}
      onInput={handle}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onPointerDown={() => {
        touchGuard.onPointerDown();
        onMouseDown?.();
      }}
      onPointerUp={() => {
        touchGuard.onPointerUp();
        onMouseUp?.();
      }}
      onPointerCancel={touchGuard.onPointerUp}
      onTouchStart={() => {
        touchGuard.onTouchStart();
        onTouchStart?.();
      }}
      onTouchEnd={() => {
        touchGuard.onTouchEnd();
        onTouchEnd?.();
      }}
    />
  );

  return (
    <form
      ref={formRef}
      className={`${styles.form} ${vertical ? styles.vertical : ''} ${className} ${disabled ? styles.disabled : ''}`}
      style={vertical ? { height } : undefined}
      onSubmit={(e) => e.preventDefault()}
    >
      {vertical ? (
        <div className="ab-dmx-range-host--vertical">{rangeInput}</div>
      ) : (
        <div className={styles.horizontalHost}>
          {rangeInput}
          {normalizedTicks.length > 0 && (
            <div className={styles.tickRail} aria-hidden="true">
              {normalizedTicks.map((tick, index) => (
                <span
                  key={`${tick.value}-${index}`}
                  className={styles.tickMark}
                  style={{ left: `${tick.pct}%` }}
                  title={tick.label}
                >
                  {showTickLabels && tick.label ? (
                    <span className={styles.tickLabel}>{tick.label}</span>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <datalist id={ticksId} className={styles.datalist}>
        <option label="min" value={min} />
        {normalizedTicks.map((tick, index) => (
          <option
            key={`${tick.value}-${index}`}
            label={tick.label || String(tick.value)}
            value={tick.value}
          />
        ))}
        <option label="max" value={max} />
      </datalist>
    </form>
  );
};
