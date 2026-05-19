import React, { useMemo } from 'react';
import type { FixtureChannelRange } from '../../../store/types';
import {
  clampToRange,
  findTickIndexForValue,
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
  vertical = true,
  className = '',
  faderSize = 'default',
}) => {
  const useTicks = shouldUseTickFader(ticksOnly, fixtureRanges);
  const ranges = fixtureRanges ?? [];

  const activeRange = useMemo(() => {
    if (!useTicks || !ranges.length) return { min, max };
    const idx = findTickIndexForValue(ranges, value);
    const r = ranges[idx];
    return { min: r.min, max: r.max };
  }, [useTicks, ranges, value, min, max]);

  if (!vertical) {
    return (
      <MasterStyledSlider
        className={className}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (useTicks) {
    return (
      <div className={`${styles.root} ${className}`}>
        <span className={styles.modeBadge}>Ticks</span>
        <div className={styles.dual}>
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
        size={faderSize}
        className={styles.faderFill}
      />
    </div>
  );
};
