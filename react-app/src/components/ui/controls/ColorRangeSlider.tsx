import React, { useEffect, useRef } from 'react';
import styles from './ColorRangeSlider.module.scss';

export type ColorRangeVariant = 'red' | 'green' | 'blue' | 'generic';

export interface ColorRangeSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  variant?: ColorRangeVariant;
  onChange: (value: number) => void;
  onInput?: (value: number) => void;
  className?: string;
  'aria-label'?: string;
}

export const ColorRangeSlider: React.FC<ColorRangeSliderProps> = ({
  value,
  min = 0,
  max = 255,
  step = 1,
  disabled = false,
  variant = 'generic',
  onChange,
  onInput,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.setProperty('--val', String(value));
    el.style.setProperty('--min', String(min));
    el.style.setProperty('--max', String(max));
  }, [value, min, max]);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    inputRef.current?.style.setProperty('--val', String(v));
    onInput?.(v);
    onChange(v);
  };

  const variantClass =
    variant === 'red'
      ? styles.variantRed
      : variant === 'green'
        ? styles.variantGreen
        : variant === 'blue'
          ? styles.variantBlue
          : styles.variantGeneric;

  return (
    <input
      ref={inputRef}
      type="range"
      className={`${styles.input} ${variantClass} ${className}`.trim()}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={handle}
      onInput={handle}
      aria-label={ariaLabel}
    />
  );
};
