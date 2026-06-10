import type { Apc40Model } from './apc40';
import { apc40DeckSceneName } from './apc40WorkflowHelpers';

export type Apc40Deck = 'A' | 'B';

export interface ApcNoteAddress {
  note: number;
  channel: number;
}

export interface ApcCcAddress {
  controller: number;
  channel: number;
}

export const APC40_GRID_ROWS = 5;
export const APC40_GRID_COLS = 8;

export function clipNoteForCell(
  model: Apc40Model,
  row: number,
  col: number
): ApcNoteAddress {
  if (model === 'apc40-mk1') {
    return { note: 0x35 + row, channel: col };
  }
  return { note: row * 8 + col, channel: 0 };
}

export function sceneLaunchNoteForIndex(index: number): ApcNoteAddress {
  return { note: 0x52 + index, channel: 0 };
}

export function trackSelectNoteForColumn(col: number): ApcNoteAddress {
  return { note: 0x33, channel: col };
}

export function recordArmNoteForColumn(col: number): ApcNoteAddress {
  return { note: 0x30, channel: col };
}

export function soloNoteForColumn(col: number): ApcNoteAddress {
  return { note: 0x31, channel: col };
}

export function activatorNoteForColumn(col: number): ApcNoteAddress {
  return { note: 0x32, channel: col };
}

export function trackStopNoteForColumn(col: number): ApcNoteAddress {
  return { note: 0x34, channel: col };
}

export function channelFaderCcForColumn(col: number): ApcCcAddress {
  return { controller: 0x07, channel: col };
}

export function deviceKnobCc(slot: number): ApcCcAddress {
  return { controller: 0x10 + slot, channel: 0 };
}

export function trackKnobCc(slot: number): ApcCcAddress {
  return { controller: 0x30 + slot, channel: 0 };
}

export const APC40_TRANSPORT_NOTES = {
  shift: 0x62,
  play: 0x5b,
  stop: 0x5c,
  record: 0x5d,
  navFixturePrev: 0x5e,
  navFixtureNext: 0x5f,
  navScenePrev: 0x60,
  navSceneNext: 0x61,
  selectAll: 0x57,
  stopAll: 0x51,
  masterButton: 0x33,
} as const;

export const APC40_MASTER_CC = {
  master: 0x0e,
  crossfader: 0x0f,
  cue: 0x2f,
} as const;

// The deck-A scene name a clip pad at (row, col) launches under the default
// useApc40Workflow contract: rows fill 8-wide before wrapping. Used to render
// scene labels on the diagram cells and to highlight the active cell when
// activeSceneName matches.
export function clipSceneNameForCell(deck: Apc40Deck, row: number, col: number): string {
  const index = row * APC40_GRID_COLS + col;
  return apc40DeckSceneName(deck, index);
}
