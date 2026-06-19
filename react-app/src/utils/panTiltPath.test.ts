import { describe, expect, it } from 'vitest';
import { samplePanTiltPath } from './panTiltPath';

describe('samplePanTiltPath', () => {
  it('interpolates between custom path points instead of stepping', () => {
    const sample = samplePanTiltPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      0.25,
      { closed: false, smoothing: 0 }
    );

    expect(sample?.x).toBe(25);
    expect(sample?.y).toBe(25);
  });

  it('keeps one-shot paths on the final point at the end', () => {
    const sample = samplePanTiltPath(
      [
        { x: 10, y: 20 },
        { x: 200, y: 220 },
      ],
      1,
      { closed: false, smoothing: 1 }
    );

    expect(sample).toEqual({ x: 200, y: 220 });
  });

  it('wraps closed loops without returning undefined at the seam', () => {
    const sample = samplePanTiltPath(
      [
        { x: 0, y: 0 },
        { x: 255, y: 0 },
        { x: 255, y: 255 },
        { x: 0, y: 255 },
      ],
      0.99,
      { closed: true, smoothing: 0.75 }
    );

    expect(sample?.x).toBeGreaterThanOrEqual(0);
    expect(sample?.x).toBeLessThanOrEqual(255);
    expect(sample?.y).toBeGreaterThanOrEqual(0);
    expect(sample?.y).toBeLessThanOrEqual(255);
  });
});
