import React, { useMemo } from 'react';
import type { FixtureChannelRange } from '../../../store/types';
import {
  ChannelTickStep,
  findTickIndexForValue,
  rangesToTickSteps,
} from '../../../utils/fixtureChannelTicks';
import { useVerticalFaderLength } from './useVerticalFaderLength';
import type { DmxFaderSize } from './DmxVerticalFader';
import styles from './DmxSteppedVerticalFader.module.scss';

export interface DmxSteppedVerticalFaderProps {
  value: number;
  ranges: FixtureChannelRange[];
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  label?: string;
  size?: DmxFaderSize;
}

export const DmxSteppedVerticalFader: React.FC<DmxSteppedVerticalFaderProps> = ({
  value,
  ranges,
  disabled = false,
  onChange,
  className = '',
  label = 'Slot',
  size = 'default',
}) => {
  const steps: ChannelTickStep[] = useMemo(() => rangesToTickSteps(ranges), [ranges]);
  const activeIndex = findTickIndexForValue(ranges, value);
  const stepCount = Math.max(1, steps.length);
  const sliderValue = activeIndex + 1;

  const handleStep = (index: number) => {
    const step = steps[Math.max(0, Math.min(steps.length - 1, index))];
    if (step) onChange(step.value);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleStep(parseInt(e.target.value, 10) - 1);
  };

  const active = steps[activeIndex];
  const faderShellRef = useVerticalFaderLength<HTMLDivElement>();

  return (
    <div
      className={`${styles.wrap} ${size === 'touch' ? styles.sizeTouch : ''} ${className} ${disabled ? styles.disabled : ''}`}
      style={{ ['--steps' as string]: stepCount }}
    >
      <span className={styles.label}>{label}</span>
      <div ref={faderShellRef} className={styles.faderShell}>
        <input
          type="range"
          className={`${styles.input} ab-styled-fader`}
          min={1}
          max={stepCount}
          step={1}
          value={sliderValue}
          disabled={disabled || steps.length === 0}
          onChange={handleInput}
          onInput={handleInput}
          aria-label={`${label} selection`}
        />
      </div>
      {active && (
        <>
          <div className={styles.tickName} title={active.label}>
            {active.label}
          </div>
          <div className={styles.tickMeta}>
            DMX {active.min}-{active.max} ({value})
          </div>
        </>
      )}
      {steps.length <= 8 && (
        <div className={styles.tickButtons}>
          {steps.map((s, i) => (
            <button
              key={`${s.min}-${s.max}-${i}`}
              type="button"
              className={`${styles.tickBtn} ${i === activeIndex ? styles.active : ''}`}
              disabled={disabled}
              title={`${s.label} (${s.min}-${s.max})`}
              onClick={() => handleStep(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
