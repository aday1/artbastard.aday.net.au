import React, { useEffect, useId, useRef } from 'react';
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

  return (
    <form
      ref={formRef}
      className={`${styles.form} ${vertical ? styles.vertical : ''} ${className} ${disabled ? styles.disabled : ''}`}
      style={vertical ? { height } : undefined}
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        list={ticksId}
        className={`${styles.input} ab-styled-fader`}
        onChange={handle}
        onInput={handle}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <datalist id={ticksId} className={styles.datalist}>
        <option label="min" value={min} />
        <option label="max" value={max} />
      </datalist>
    </form>
  );
};
