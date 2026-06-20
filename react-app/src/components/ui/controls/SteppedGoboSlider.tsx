import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fine, setFine] = useState(false);
  const tickmarks = useMemo(() => steps.map((s) => s.value), [steps]);
  const activeIndex = nearestStepIndex(steps, value);
  const activeStep = steps[activeIndex];
  const snapped = snapToNearestTick(tickmarks, value);
  const progressPct = (snapped / DMX_MAX) * 100;

  const syncVars = useCallback(
    (dmxVal: number) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.style.setProperty('--value', String(dmxVal));
      wrap.style.setProperty('--pos', `${(dmxVal / DMX_MAX) * 100}%`);
      wrap.style.setProperty('--step-index', String(nearestStepIndex(steps, dmxVal)));
      wrap.style.setProperty('--step-count', String(Math.max(1, steps.length)));
    },
    [steps]
  );

  useEffect(() => {
    const v = snapToNearestTick(tickmarks, value);
    if (inputRef.current) inputRef.current.value = String(v);
    syncVars(v);
  }, [value, tickmarks, syncVars]);

  const applyValue = (raw: number) => {
    const next = fine
      ? Math.max(0, Math.min(DMX_MAX, Math.round(raw)))
      : snapToNearestTick(tickmarks, raw);
    if (inputRef.current) inputRef.current.value = String(next);
    syncVars(next);
    onChange(next);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyValue(parseFloat(e.target.value));
  };

  const nudge = (dir: -1 | 1) => {
    const idx = nearestStepIndex(steps, snapped);
    const nextIdx = Math.min(steps.length - 1, Math.max(0, idx + dir));
    applyValue(steps[nextIdx]?.value ?? snapped);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(1);
    }
  };

  return (
    <div
      className={`${styles.root} ${className} ${disabled ? styles.disabled : ''} ${fine ? styles.fine : ''}`}
      ref={wrapRef}
      style={
        {
          '--value': snapped,
          '--pos': `${progressPct}%`,
          '--step-index': activeIndex,
          '--step-count': Math.max(1, steps.length),
        } as React.CSSProperties
      }
    >
      <div className={styles.toolbar}>
        <button type="button" className={styles.nudge} disabled={disabled || activeIndex <= 0} onClick={() => nudge(-1)}>
          Prev
        </button>
        <label className={styles.fineToggle} title="Fine: continuous DMX 0-255 between gobo slots. Off: snap to each wheel position.">
          <input type="checkbox" checked={fine} onChange={(e) => setFine(e.target.checked)} disabled={disabled} />
          Fine
        </label>
        <button
          type="button"
          className={styles.nudge}
          disabled={disabled || activeIndex >= steps.length - 1}
          onClick={() => nudge(1)}
        >
          Next
        </button>
      </div>

      <div className={styles.rangeSlider}>
        <div className={styles.cubeTrack} aria-hidden>
          {steps.map((s, i) => (
            <span
              key={`${s.value}-${i}`}
              className={[styles.cube, i <= activeIndex ? styles.cubeLit : ''].filter(Boolean).join(' ')}
              style={{ left: `${(s.value / DMX_MAX) * 100}%` }}
              title={s.label}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          type="range"
          className={styles.input}
          list={listId}
          min={0}
          max={DMX_MAX}
          step={fine ? 1 : 1}
          defaultValue={snapped}
          disabled={disabled || steps.length === 0}
          onInput={handleInput}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          aria-label="Gobo wheel"
          aria-valuenow={snapped}
          aria-valuetext={activeStep?.label ?? String(snapped)}
        />
        <datalist id={listId}>
          {steps.map((s, i) => (
            <option key={`${s.value}-${i}`} value={s.value} label={s.label} />
          ))}
        </datalist>
        <div className={styles.progress} aria-hidden />
        <output className={styles.output}>{activeStep?.label ?? snapped}</output>
      </div>

      <div className={styles.valueReadout}>
        {activeStep?.label ?? '-'}
        <span className={styles.dmxValue}>
          DMX {activeStep?.min ?? '-'} - {activeStep?.max ?? '-'} ({snapped})
        </span>
        {fine ? (
          <span className={styles.fineHint}>Fine mode: sliding between slot centers without snapping.</span>
        ) : null}
      </div>
    </div>
  );
};
