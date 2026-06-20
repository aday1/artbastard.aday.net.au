import type { SceneSeedMode, SceneSeedPackId } from './sceneSeedGenerator';

export interface SceneSeedModeUi {
  id: SceneSeedMode;
  label: string;
  summary: string;
  detail: string;
}

export interface SceneSeedPackUi {
  id: SceneSeedPackId;
  label: string;
  creates: string;
  includes: string[];
  leavesOpen: string;
  bestFor: string;
}

export const SCENE_SEED_MODES: SceneSeedModeUi[] = [
  {
    id: 'pack',
    label: 'Fill slots from pack',
    summary: 'Generate many APC clip scenes at once from a template list.',
    detail:
      'Each template becomes one APC clip (Deck A 01, Deck A 02, and so on). Existing generated scenes in those slots are refreshed. Handmade scenes and scenes you captured yourself are kept unless they occupy the same slot name.',
  },
  {
    id: 'single-slot',
    label: 'One slot look',
    summary: 'Add or replace a single APC clip without touching the rest of the bank.',
    detail:
      'Pick deck, slot number, and a look template. Use "Selected fixtures only" to audition washes or movers without rewriting the whole rig. Good for filling slots 15-40 after the Essential 14+14 pack.',
  },
  {
    id: 'capture-selection',
    label: 'Capture live look',
    summary: 'Save what is on stage right now into one APC clip slot.',
    detail:
      'Writes current DMX from your selected fixtures into one slot so you can load it later and decide keep or toss. Does not run any template; it is a snapshot of your live tweak.',
  },
];

export const SCENE_SEED_PACK_UI: Record<SceneSeedPackId, SceneSeedPackUi> = {
  'essential-ab-28': {
    id: 'essential-ab-28',
    label: 'Essential 14+14 (A and B)',
    creates: '28 scenes: APC40 Deck A 01-14 and Deck B 01-14.',
    includes: [
      'Safety: blackout, full open',
      'Washes: warm, cool, cyan, magenta, amber glow',
      'Slow RGB: red, green, blue',
      'Movers: center spot, left sweep, right sweep, gobo texture',
    ],
    leavesOpen: 'Slots 15-40 on both decks stay empty for your own captures and single-slot seeds.',
    bestFor: 'Default starting point. Enough to play and crossfade without filling the whole 40x40 bank.',
  },
  'operator-rows-ab-48': {
    id: 'operator-rows-ab-48',
    label: 'Operator rows 3-5 (A and B)',
    creates: '48 scenes: APC40 slots 17-40 on Deck A and Deck B (24 looks per deck).',
    includes: [
      'Row 3 (17-24): pan/tilt only — center, left, right, up, down, fan, sweep, corner 90',
      'Row 4 (25-32): color only — red, blue, green, amber, cyan, magenta, white, color cycle',
      'Row 5 (33-40): color + pan/tilt — mix looks, warm sweep, cool 90, fan cycle',
      'Never writes dimmer, shutter, gobo, or strobe',
    ],
    leavesOpen: 'Slots 01-16 stay for Essential 14+14 or your own row 1-2 looks.',
    bestFor: 'Layer rows 3-5 over Essential on rows 1-2. You dial dimmers and strobe yourself. Check Include automation for sweeps and color cycles.',
  },
  'compact-starter': {
    id: 'compact-starter',
    label: 'Basics 16 (one deck)',
    creates: '16 scenes on Deck A OR Deck B only (slots 01-16).',
    includes: [
      'Same core looks as Essential, plus UV hit',
      'Includes one strobe-move look in slot 16 (skipped if NO STROBE is on)',
    ],
    leavesOpen: 'Slots 17-40 stay empty on the chosen deck.',
    bestFor: 'Smallest one-deck starter when you do not need Deck B filled yet.',
  },
  'smart-starter-40': {
    id: 'smart-starter-40',
    label: 'Extended 40 (one deck)',
    creates: '40 scenes on Deck A OR Deck B only (every slot filled).',
    includes: [
      'Slow and fast color, dimmer pulse, color chase',
      'Movement: sweeps, fan, 90-degree move, mirror',
      'Gobo open/texture/rotate, prism, narrow/wide beam, focus sweep',
      'Wash slow/fast, warm gobo, finale full',
      'Strobe all, strobe color, strobe move (respects NO STROBE)',
    ],
    leavesOpen: 'Nothing; all 40 slots on the chosen deck are used.',
    bestFor: 'When you want the entire deck pre-filled before you edit or replace looks.',
  },
  'smart-ab-80': {
    id: 'smart-ab-80',
    label: 'Extended 40+40 (both decks)',
    creates: '80 scenes: all 40 slots on Deck A and all 40 on Deck B.',
    includes: [
      'Same extended library as Extended 40',
      'Deck B variants mirror color and pan for crossfader-friendly A/B pairs',
    ],
    leavesOpen: 'Nothing; both decks are fully filled.',
    bestFor: 'Maximum pre-built bank for A/B crossfader workflows. Heavy; most users start with Essential 14+14 instead.',
  },
};

export const SCENE_BOTH_DECK_PACKS: SceneSeedPackId[] = [
  'essential-ab-28',
  'operator-rows-ab-48',
  'smart-ab-80',
];

export function sceneSeedPackUi(packId: SceneSeedPackId): SceneSeedPackUi {
  return SCENE_SEED_PACK_UI[packId] ?? SCENE_SEED_PACK_UI['essential-ab-28'];
}

export function sceneSeedModeUi(mode: SceneSeedMode): SceneSeedModeUi {
  return SCENE_SEED_MODES.find((entry) => entry.id === mode) ?? SCENE_SEED_MODES[0];
}
