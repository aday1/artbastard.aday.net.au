import React, { useEffect, useRef } from 'react';
import styles from './SteppedGoboSlider.module.scss';

export interface GoboStep {
  value: number;
  label: string;
  image?: string;
}

export interface SteppedGoboSliderProps {
  value: number;
  steps: GoboStep[];
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

function nearestStepIndex(steps: GoboStep[], value: number): number {
  let best = 0;
  let bestDist = Infinity;
  steps.forEach((s, i) => {
    const d = Math.abs(s.value - value);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export const SteppedGoboSlider: React.FC<SteppedGoboSliderProps> = ({
  value,
  steps,
  disabled = false,
  onChange,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndex = nearestStepIndex(steps, value);
  const min = 1;
  const max = Math.max(1, steps.length);

  useEffect(() => {
    const el = inputRef.current;
    if (el) el.setAttribute('value', String(activeIndex + 1));
  }, [activeIndex]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10) - 1;
    const step = steps[Math.max(0, Math.min(steps.length - 1, idx))];
    if (step) onChange(step.value);
  };

  return (
    <div className={`${styles.root} ${className} ${disabled ? styles.disabled : ''}`}>
      <input
        ref={inputRef}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={1}
        value={activeIndex + 1}
        disabled={disabled || steps.length === 0}
        onChange={handleChange}
        onInput={handleChange}
      />
      <div className={styles.stepLabels}>
        {steps.map((s, i) => (
          <button
            key={`${s.value}-${i}`}
            type="button"
            className={`${styles.stepBtn} ${i === activeIndex ? styles.active : ''}`}
            disabled={disabled}
            title={`${s.label} (${s.value})`}
            onClick={() => onChange(s.value)}
          >
            {s.image ? (
              <img src={s.image} alt="" className={styles.stepImg} />
            ) : (
              <span className={styles.stepNum}>{i + 1}</span>
            )}
            <span className={styles.stepName}>{s.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.valueReadout}>
        {steps[activeIndex]?.label ?? '—'} ({value})
      </div>
    </div>
  );
};
