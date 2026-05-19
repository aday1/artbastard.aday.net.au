import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import styles from './SteppedGoboSlider.module.scss';

export interface GoboStep {
  value: number;
  label: string;
  min?: number;
  max?: number;
  image?: string;
}

export interface SteppedGoboSliderProps {
  value: number;
  steps: GoboStep[];
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

const DMX_MAX = 255;

function snapToNearestTick(tickmarks: number[], raw: number): number {
  if (!tickmarks.length) return Math.round(raw);
  let best = tickmarks[0];
  let bestDist = Infinity;
  for (const tick of tickmarks) {
    const d = Math.abs(tick - raw);
    if (d < bestDist) {
      bestDist = d;
      best = tick;
    }
  }
  return best;
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
  const listId = useId().replace(/:/g, '');
  const rangeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickmarks = useMemo(() => steps.map((s) => s.value), [steps]);
  const activeIndex = nearestStepIndex(steps, value);
  const activeStep = steps[activeIndex];

  const updateFill = useCallback((dmxVal: number) => {
    const wrap = rangeRef.current;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const fillPx = (dmxVal / DMX_MAX) * w;
    wrap.style.setProperty('--fill-w', `${fillPx}px`);
  }, []);

  useEffect(() => {
    const snapped = snapToNearestTick(tickmarks, value);
    const input = inputRef.current;
    if (input) input.value = String(snapped);
    updateFill(snapped);
  }, [value, tickmarks, updateFill]);

  useEffect(() => {
    const wrap = rangeRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const snapped = snapToNearestTick(tickmarks, Number(inputRef.current?.value ?? value));
      updateFill(snapped);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [tickmarks, value, updateFill]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    const snapped = snapToNearestTick(tickmarks, raw);
    if (inputRef.current) inputRef.current.value = String(snapped);
    updateFill(snapped);
    onChange(snapped);
  };

  return (
    <div className={`${styles.root} ${className} ${disabled ? styles.disabled : ''}`}>
      <div ref={rangeRef} className={styles.range}>
        <input
          ref={inputRef}
          type="range"
          className={styles.input}
          list={listId}
          min={0}
          max={DMX_MAX}
          step={1}
          defaultValue={snapToNearestTick(tickmarks, value)}
          disabled={disabled || steps.length === 0}
          onInput={handleInput}
          onChange={handleInput}
          aria-label="Gobo wheel"
          aria-valuemin={0}
          aria-valuemax={DMX_MAX}
          aria-valuenow={snapToNearestTick(tickmarks, value)}
          aria-valuetext={activeStep?.label ?? String(value)}
        />
        <datalist id={listId} className={styles.datalist}>
          {steps.map((s, i) => (
            <option key={`${s.value}-${i}`} value={s.value} label={s.label} />
          ))}
        </datalist>
        <div
          className={styles.rangeValue}
          style={{ left: `${(snapToNearestTick(tickmarks, value) / DMX_MAX) * 100}%` }}
          aria-hidden
        >
          {activeStep?.label ?? '—'}
        </div>
      </div>
      <div className={styles.valueReadout}>
        {activeStep?.label ?? '—'}
        <span className={styles.dmxValue}>
          DMX {activeStep?.min ?? '—'}-{activeStep?.max ?? '—'} ({snapToNearestTick(tickmarks, value)})
        </span>
      </div>
    </div>
  );
};

