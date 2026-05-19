import React, { useId } from 'react';
import styles from './SkeuoKnobSlider.module.scss';

export interface SkeuoKnobSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: number) => void;
  className?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Compact metallic horizontal fader (thebabydino RNYrJM) for speed / secondary controls. */
export const SkeuoKnobSlider: React.FC<SkeuoKnobSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  onChange,
  className = '',
}) => {
  const inputId = useId().replace(/:/g, '');

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(clamp(parseFloat(e.target.value), min, max));
  };

  return (
    <div className={`${styles.wrap} ${className} ${disabled ? styles.disabled : ''}`}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.housing}>
        <input
          id={inputId}
          type="range"
          className={`ab-dmx-range ab-dmx-range--compact ${styles.input}`}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleInput}
          onInput={handleInput}
          aria-label={label ?? 'Speed'}
        />
      </div>
      <output className={styles.readout} htmlFor={inputId}>
        {value}
      </output>
    </div>
  );
};
