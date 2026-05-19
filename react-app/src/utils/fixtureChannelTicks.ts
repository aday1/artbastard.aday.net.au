import type { FixtureChannelRange } from '../store/types';

export interface ChannelTickStep {
  value: number;
  label: string;
  min: number;
  max: number;
}

export function rangesToTickSteps(ranges: FixtureChannelRange[]): ChannelTickStep[] {
  return ranges.map((r) => ({
    min: r.min,
    max: r.max,
    value: Math.round((r.min + r.max) / 2),
    label: r.description?.trim() || `DMX ${r.min}-${r.max}`,
  }));
}

export function findTickIndexForValue(ranges: FixtureChannelRange[], value: number): number {
  if (!ranges.length) return 0;
  for (let i = 0; i < ranges.length; i++) {
    if (value >= ranges[i].min && value <= ranges[i].max) return i;
  }
  let best = 0;
  let bestDist = Infinity;
  ranges.forEach((r, i) => {
    const mid = (r.min + r.max) / 2;
    const d = Math.abs(value - mid);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export function shouldUseTickFader(
  ticksOnly: boolean | undefined,
  ranges: FixtureChannelRange[] | undefined
): boolean {
  return Boolean(ticksOnly && ranges && ranges.length > 0);
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
