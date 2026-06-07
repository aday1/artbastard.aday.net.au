import React, { useEffect, useId, useRef } from 'react';
import { useRangeTouchGuard } from './useRangeTouchGuard';
import styles from './MasterStyledSlider.module.scss';

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
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const ticksId = useId();
  const touchGuard = useRangeTouchGuard(disabled);

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
        <div className={styles.horizontalHost}>{rangeInput}</div>
      )}
      <datalist id={ticksId} className={styles.datalist}>
        <option label="min" value={min} />
        <option label="max" value={max} />
      </datalist>
    </form>
  );
};
