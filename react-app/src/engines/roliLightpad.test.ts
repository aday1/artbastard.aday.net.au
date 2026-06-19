import { describe, expect, it } from 'vitest';
import {
  ROLI_GRID_COLS,
  ROLI_GRID_ROWS,
  composeLedFrame,
  rgbaFrameToRoliLedData,
  rgbaToBgr565,
  sampleRgbaToLedFrame,
  shouldRouteGenericRoliMidiTouchSource,
  shouldRouteRoliTouchSource,
} from './roliLightpad';

function pixel(frame: Uint8ClampedArray, x: number, y: number): [number, number, number, number] {
  const idx = (y * ROLI_GRID_COLS + x) * 4;
  return [frame[idx], frame[idx + 1], frame[idx + 2], frame[idx + 3]];
}

describe('Roli Lightpad LED helpers', () => {
  it('packs RGBA into the BGR565 word order expected by BLOCKS BitmapLED', () => {
    expect(rgbaToBgr565(255, 0, 0, 255)).toBe(0x001f);
    expect(rgbaToBgr565(0, 255, 0, 255)).toBe(0x07e0);
    expect(rgbaToBgr565(0, 0, 255, 255)).toBe(0xf800);
  });

  it('maps the 15x15 RGBA frame into row-major little-endian LED bytes', () => {
    const frame = new Uint8ClampedArray(ROLI_GRID_COLS * ROLI_GRID_ROWS * 4);
    frame.set([255, 0, 0, 255], 0);
    frame.set([0, 0, 255, 255], frame.length - 4);

    const led = rgbaFrameToRoliLedData(frame);
    expect([led[0], led[1]]).toEqual([0x1f, 0x00]);
    expect([led[led.length - 2], led[led.length - 1]]).toEqual([0x00, 0xf8]);
  });

  it('rasterizes fast path strokes as continuous 15x15 lines', () => {
    const frame = composeLedFrame({
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });

    for (let i = 0; i < ROLI_GRID_COLS; i++) {
      expect(pixel(frame, i, i)[3]).toBeGreaterThan(0);
    }
  });

  it('keeps edge cursors bright instead of letting the halo overwrite them', () => {
    const frame = composeLedFrame({ cursor: { x: 0, y: 0 } });

    expect(pixel(frame, 0, 0)).toEqual([255, 120, 255, 255]);
    expect(pixel(frame, 1, 0)).toEqual([128, 60, 128, 128]);
    expect(pixel(frame, 0, 1)).toEqual([128, 60, 128, 128]);
  });

  it('downsamples larger RGBA sources into the Lightpad grid for shader-style LED feeds', () => {
    const source = new Uint8ClampedArray(30 * 30 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        source.set([200, 20, 10, 255], (y * 30 + x) * 4);
      }
    }
    for (let y = 28; y < 30; y++) {
      for (let x = 28; x < 30; x++) {
        source.set([10, 20, 200, 255], (y * 30 + x) * 4);
      }
    }

    const frame = sampleRgbaToLedFrame(source, 30, 30);
    expect(pixel(frame, 0, 0)).toEqual([200, 20, 10, 255]);
    expect(pixel(frame, 14, 14)).toEqual([10, 20, 200, 255]);
  });

  it('suppresses touch routing from hidden joined-topology parent ports', () => {
    expect(shouldRouteRoliTouchSource({ hidden: false })).toBe(true);
    expect(shouldRouteRoliTouchSource({ hidden: true })).toBe(false);
  });

  it('suppresses ambiguous generic MIDI fallback when a parent has logical child blocks', () => {
    expect(shouldRouteGenericRoliMidiTouchSource({ hidden: false }, false)).toBe(true);
    expect(shouldRouteGenericRoliMidiTouchSource({ hidden: true }, true)).toBe(false);
    expect(shouldRouteGenericRoliMidiTouchSource({ hidden: false }, true)).toBe(false);
  });
});
