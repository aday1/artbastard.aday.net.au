import type { Apc40Model } from './apc40';
import { apc40DeckSceneName } from './apc40WorkflowHelpers';
import {
  APC40_GRID as GENERATED_APC40_GRID,
  APC40_TRANSPORT_NOTES as GENERATED_APC40_TRANSPORT_NOTES,
  APC40_MASTER_CC as GENERATED_APC40_MASTER_CC,
} from './generated';

export type Apc40Deck = 'A' | 'B';

export interface ApcNoteAddress {
  note: number;
  channel: number;
}

export interface ApcCcAddress {
  controller: number;
  channel: number;
}

export const APC40_GRID_ROWS = GENERATED_APC40_GRID.rows;
export const APC40_GRID_COLS = GENERATED_APC40_GRID.cols;

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

export const APC40_TRANSPORT_NOTES = GENERATED_APC40_TRANSPORT_NOTES;

export const APC40_MASTER_CC = GENERATED_APC40_MASTER_CC;

// The deck-A scene name a clip pad at (row, col) launches under the default
// useApc40Workflow contract: rows fill 8-wide before wrapping. Used to render
// scene labels on the diagram cells and to highlight the active cell when
// activeSceneName matches.
export function clipSceneNameForCell(deck: Apc40Deck, row: number, col: number): string {
  const index = row * APC40_GRID_COLS + col;
  return apc40DeckSceneName(deck, index);
}
