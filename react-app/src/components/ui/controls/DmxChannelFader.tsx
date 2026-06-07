import React, { useMemo } from 'react';
import type { FixtureChannelRange } from '../../../store/types';
import {
  clampToRange,
  findTickIndexForValue,
  rangesToTickSteps,
  shouldUseTickFader,
} from '../../../utils/fixtureChannelTicks';
import { DmxVerticalFader, type DmxFaderSize } from './DmxVerticalFader';
import { DmxSteppedVerticalFader } from './DmxSteppedVerticalFader';
import { MasterStyledSlider } from './MasterStyledSlider';
import styles from './DmxChannelFader.module.scss';

export interface DmxChannelFaderProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  fixtureRanges?: FixtureChannelRange[];
  ticksOnly?: boolean;
  auxFullRange?: boolean;
  onToggleAuxFullRange?: () => void;
  vertical?: boolean;
  className?: string;
  faderSize?: DmxFaderSize;
}

export const DmxChannelFader: React.FC<DmxChannelFaderProps> = ({
  value,
  min = 0,
  max = 255,
  disabled = false,
  onChange,
  fixtureRanges,
  ticksOnly = false,
  auxFullRange = false,
  onToggleAuxFullRange,
  vertical = true,
  className = '',
  faderSize = 'default',
}) => {
  const useTicks = shouldUseTickFader(ticksOnly, fixtureRanges);
  const ranges = fixtureRanges ?? [];
  const tickSteps = useMemo(() => rangesToTickSteps(ranges), [ranges]);

  const activeRange = useMemo(() => {
    if (!useTicks || !ranges.length) return { min, max };
    const idx = findTickIndexForValue(ranges, value);
    const r = ranges[idx];
    return { min: r.min, max: r.max };
  }, [useTicks, ranges, value, min, max]);

  const showFullFader = !onToggleAuxFullRange || auxFullRange;

  if (!vertical) {
    const tickMarks = tickSteps.flatMap((step) => [
      {
        value: step.min,
        label: `${step.label}: ${step.min}-${step.max}`,
        min: step.min,
        max: step.max,
      },
      {
        value: step.max,
        label: `${step.label}: ${step.min}-${step.max}`,
        min: step.min,
        max: step.max,
      },
    ]);

    return (
      <div className={`${styles.horizontal} ${className}`}>
        <MasterStyledSlider
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          ticks={tickMarks}
          onChange={onChange}
        />
        {ticksOnly && tickSteps.length > 0 ? (
          <div className={styles.horizontalTicks} aria-label="Fixture range notches">
            {tickSteps.slice(0, 12).map((step, index) => {
              const active = value >= step.min && value <= step.max;
              return (
                <button
                  key={`${step.min}-${step.max}-${index}`}
                  type="button"
                  className={`${styles.horizontalTickButton} ${active ? styles.horizontalTickActive : ''}`}
                  disabled={disabled}
                  onClick={() => onChange(step.value)}
                  title={`${step.label} (DMX ${step.min}-${step.max})`}
                >
                  <span>{step.label}</span>
                  <small>{step.min}-{step.max}</small>
                </button>
              );
            })}
            {tickSteps.length > 12 ? (
              <span className={styles.horizontalTicksMore}>
                +{tickSteps.length - 12} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (useTicks) {
    return (
      <div className={`${styles.root} ${className}`}>
        {onToggleAuxFullRange ? (
          <button
            type="button"
            className={`${styles.modeBadge} ${showFullFader ? styles.modeBadgeActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAuxFullRange();
            }}
            title={
              showFullFader
                ? 'Hide full 0-255 fader (slot + fine only). Alt+click TICKS also toggles.'
                : 'Show full 0-255 fader alongside slot and fine. Alt+click TICKS also toggles.'
            }
          >
            {showFullFader ? 'Ticks + Full' : 'Ticks'}
          </button>
        ) : null}
        <div className={showFullFader ? styles.triple : styles.dual}>
          <div className={styles.slotCol}>
            <DmxSteppedVerticalFader
              value={value}
              ranges={ranges}
              disabled={disabled}
              onChange={onChange}
              label="Slot"
              size={faderSize}
            />
          </div>
          <div className={styles.fineCol}>
            <DmxVerticalFader
              value={clampToRange(value, activeRange.min, activeRange.max)}
              min={activeRange.min}
              max={activeRange.max}
              disabled={disabled}
              onChange={onChange}
              readoutLabel={`Fine ${activeRange.min}-${activeRange.max}`}
              showReadout
              size={faderSize}
            />
          </div>
          {showFullFader ? (
            <div className={styles.fullCol}>
              <DmxVerticalFader
                value={clampToRange(value, min, max)}
                min={min}
                max={max}
                disabled={disabled}
                onChange={onChange}
                readoutLabel={`Full ${min}-${max}`}
                showReadout
                size={faderSize}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.single} ${className}`}>
      <DmxVerticalFader
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
        size={faderSize === 'default' ? 'channel' : faderSize}
        className={styles.faderFill}
      />
    </div>
  );
};


