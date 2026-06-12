/**
 * ROLI second-block colour-wheel engine.
 *
 * Renders a static HSV colour wheel onto a 15x15 ROLI Lightpad and converts
 * normalised touch (0..1, 0..1) into a hue/saturation/value triple.
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
  /** True when the touch fell inside the wheel disc; false in the corners. */
  inDisc: boolean;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hh = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; b = 0; }
  else if (hh < 120) { r = x; g = c; b = 0; }
  else if (hh < 180) { r = 0; g = c; b = x; }
  else if (hh < 240) { r = 0; g = x; b = c; }
  else if (hh < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Build a 15x15 RGBA buffer rendering a hue/saturation wheel. */
export function composeColourWheelFrame(opts?: {
  cursor?: { x: number; y: number } | null;
  cursorColor?: LedRgba;
}): Uint8ClampedArray {
  const out = new Uint8ClampedArray(PIXEL_COUNT * 4);
  const cx = (ROLI_GRID_COLS - 1) / 2;
  const cy = (ROLI_GRID_ROWS - 1) / 2;
  const radius = Math.min(cx, cy);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * ROLI_GRID_COLS + x) * 4;
      if (dist > radius + 0.5) {
        // Outside the disc: dim cool background so corners aren't black holes.
        out[idx] = 0;
        out[idx + 1] = 0;
        out[idx + 2] = 0;
        out[idx + 3] = 0;
        continue;
      }
      // Angle: 0° at +x, increasing CCW. Map so hue=0 (red) at the top.
      const angle = Math.atan2(-dy, dx); // -PI..PI
      const hue = ((angle * 180) / Math.PI + 360 + 90) % 360;
      const sat = clamp01(dist / radius);
      const val = 1;
      const [r, g, b] = hsvToRgb(hue, sat, val);
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

/** Paint the colour wheel onto the colour-wheel-role device. One-shot. */
export function paintColourWheel(opts?: {
  cursor?: { x: number; y: number } | null;
  cursorColor?: LedRgba;
}): boolean {
  return sendLedFrame(composeColourWheelFrame(opts), { role: 'colour-wheel' });
}

/**
 * Convert a ROLI touch (x,y normalised 0..1, y top-origin) into a colour from
 * the wheel. Touches outside the wheel disc are reported with `inDisc=false`
 * but still resolved to the nearest edge colour.
 */
export function colourFromTouch(x: number, y: number, pressure = 1): ColourWheelTouch {
  const nx = clamp01(x) * 2 - 1; // -1..1
  const ny = clamp01(y) * 2 - 1; // -1..1 (top=-1)
  const dist = Math.sqrt(nx * nx + ny * ny);
  // Touch y is top-origin, so flip dy to mirror composeColourWheelFrame.
  const angle = Math.atan2(-ny, nx);
  const hue = ((angle * 180) / Math.PI + 360 + 90) % 360;
  const sat = clamp01(dist);
  const val = clamp01(pressure);
  const [r, g, b] = hsvToRgb(hue, sat, val);
  return {
    h: hue,
    s: sat,
    v: val,
    r,
    g,
    b,
    hex: toHex(r, g, b),
    inDisc: dist <= 1,
  };
}
