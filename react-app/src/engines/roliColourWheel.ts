/**
 * ROLI second-block colour-strip engine.
 *
 * Renders a broad RGBW strip onto a 15x15 ROLI Lightpad and converts
 * normalised touch (0..1, 0..1) into an RGB triple. This works better than a
 * tiny wheel on the physical BLOCKS LEDs: X selects colour across chunky
 * red/yellow/green/cyan/blue/magenta/white regions, Y selects brightness.
 *
 * Pure module — no React, no DMX. Pair with `useRoliLightpad({ role:
 * 'colour-wheel' })` and a small UI component that owns the DMX writes.
 */

import {
  ROLI_GRID_COLS,
  ROLI_GRID_ROWS,
  drawCursorOnRgba,
  sendLedFrame,
} from './roliLightpad';

type LedRgba = [number, number, number, number];

const PIXEL_COUNT = ROLI_GRID_COLS * ROLI_GRID_ROWS;

export interface ColourWheelTouch {
  /** Hue in degrees, 0..360. */
  h: number;
  /** Saturation, 0..1. */
  s: number;
  /** Value, 0..1 (constant 1 unless pressure is used). */
  v: number;
  /** Convenience: 8-bit channel triple. */
  r: number;
  g: number;
  b: number;
  /** `#rrggbb`. */
  hex: string;
  /** True for every touch in this rectangular strip. Kept for API compatibility. */
  inDisc: boolean;
  /** Normalized strip position, 0..1 left-to-right. */
  x: number;
  /** Normalized brightness row, 0..1 top-to-bottom. */
  y: number;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const STRIP_STOPS: Array<{ at: number; h: number; rgb: [number, number, number] }> = [
  { at: 0.00, h: 0, rgb: [255, 0, 0] },
  { at: 0.16, h: 45, rgb: [255, 180, 0] },
  { at: 0.32, h: 120, rgb: [0, 255, 0] },
  { at: 0.48, h: 180, rgb: [0, 220, 255] },
  { at: 0.64, h: 240, rgb: [0, 70, 255] },
  { at: 0.80, h: 300, rgb: [255, 0, 255] },
  { at: 0.92, h: 0, rgb: [255, 255, 255] },
  { at: 1.00, h: 0, rgb: [255, 255, 255] },
];

function stripColorAt(x: number): { h: number; s: number; rgb: [number, number, number] } {
  const nx = clamp01(x);
  for (let i = 1; i < STRIP_STOPS.length; i++) {
    const a = STRIP_STOPS[i - 1];
    const b = STRIP_STOPS[i];
    if (nx <= b.at) {
      const span = Math.max(0.0001, b.at - a.at);
      const t = clamp01((nx - a.at) / span);
      const rgb: [number, number, number] = [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
      ];
      const whiteish = rgb[0] > 220 && rgb[1] > 220 && rgb[2] > 220;
      return { h: whiteish ? 0 : a.h + (b.h - a.h) * t, s: whiteish ? 0 : 1, rgb };
    }
  }
  return { h: 0, s: 0, rgb: [255, 255, 255] };
}

function applyBrightness(rgb: [number, number, number], brightness: number): [number, number, number] {
  const v = clamp01(brightness);
  return [
    Math.round(rgb[0] * v),
    Math.round(rgb[1] * v),
    Math.round(rgb[2] * v),
  ];
}

/** Build a 15x15 RGBA buffer rendering the RGBW strip. */
export function composeColourWheelFrame(opts?: {
  cursor?: { x: number; y: number } | null;
  cursorColor?: LedRgba;
}): Uint8ClampedArray {
  const out = new Uint8ClampedArray(PIXEL_COUNT * 4);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const idx = (y * ROLI_GRID_COLS + x) * 4;
      const strip = stripColorAt(x / (ROLI_GRID_COLS - 1));
      const brightness = 1 - y / (ROLI_GRID_ROWS - 1);
      const [r, g, b] = applyBrightness(strip.rgb, Math.max(0.06, brightness));
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = 255;
    }
  }
  if (opts?.cursor) {
    drawCursorOnRgba(out, opts.cursor, opts.cursorColor ?? [255, 255, 255, 255]);
  }
  return out;
}

/** Paint the colour strip onto the colour-wheel-role device. One-shot. */
export function paintColourWheel(opts?: {
  cursor?: { x: number; y: number } | null;
  cursorColor?: LedRgba;
}): boolean {
  return sendLedFrame(composeColourWheelFrame(opts), { role: 'colour-wheel' });
}

/**
 * Convert a ROLI touch (x,y normalised 0..1, y top-origin) into a colour from
 * the strip. X is colour, Y is brightness.
 */
export function colourFromTouch(x: number, y: number, pressure = 1): ColourWheelTouch {
  const nx = clamp01(x);
  const ny = clamp01(y);
  const strip = stripColorAt(nx);
  const val = clamp01((1 - ny) * pressure);
  const [r, g, b] = applyBrightness(strip.rgb, val);
  return {
    h: strip.h,
    s: strip.s,
    v: val,
    r,
    g,
    b,
    hex: toHex(r, g, b),
    inDisc: true,
    x: nx,
    y: ny,
  };
}
