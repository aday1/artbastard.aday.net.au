import type { ActSeedMode, ActSeedPackId } from './actSeedGenerator';

export interface ActSeedModeUi {
  id: ActSeedMode;
  label: string;
  summary: string;
  detail: string;
}

export interface ActSeedPackUi {
  id: ActSeedPackId;
  label: string;
  creates: string;
  includes: string[];
  bestFor: string;
}

export const ACT_SEED_MODES: ActSeedModeUi[] = [
  {
    id: 'pack',
    label: 'Fill ACT buttons from pack',
    summary: 'Generate several Scene Launch ACT macros at once.',
    detail:
      'Each ACT chains existing APC clip scenes in order with timed steps and crossfades. You need matching scene names on the rack first (seed scenes, then seed ACTS). Handmade ACTS are preserved.',
  },
  {
    id: 'single-template',
    label: 'One ACT template',
    summary: 'Seed a single Scene Launch button from one predefined sequence.',
    detail:
      'Pick ACT slot 1-5 and a template (color warmup, gobo texture, opening build, and so on). Good for auditioning one macro before committing to a full pack.',
  },
  {
    id: 'from-scenes',
    label: 'Build ACT from your scenes',
    summary: 'Tick scenes in order to build one custom ACT.',
    detail:
      'Uses your selected scene names as the step list. Best when you already have 14+14 or handmade clips and want one Scene Launch row that cycles through your picks.',
  },
];

export const ACT_SEED_PACK_UI: Record<ActSeedPackId, ActSeedPackUi> = {
  'starter-acts': {
    id: 'starter-acts',
    label: 'Quick audition 5',
    creates: '5 ACT macros on Scene Launch buttons 1-5.',
    includes: [
      'Color Warmup: blackout to warm/cool wash to full open (once)',
      'Red Slow: slow red base with gobo accent, loops',
      'Wash Fast: slow wash into fast wash and color chase, loops',
      'Gobo Texture: spot, texture, slow rotate, prism beam, loops',
      'Strobe Move 90: blackout hit, strobe, move-90 strobe, release (once; skipped if NO STROBE)',
    ],
    bestFor: 'Short macros to test whether your seeded scenes chain well before writing a show.',
  },
  'performance-acts': {
    id: 'performance-acts',
    label: 'Show sections 8',
    creates: '8 ACT macros on Scene Launch buttons 1-8.',
    includes: [
      'All five quick audition ACTS above',
      'Opening Build: longer blackout-to-finale opener (once, BPM synced)',
      'Movement Sweep: left/right/fan/mirror sweeps with center reset, loops',
      'Finale Punch: fast color, strobe hits, prism, blackout hit, finale full (once)',
    ],
    bestFor: 'Longer show-shaped sequences when the rack already has Extended or Essential scenes loaded.',
  },
};

export function actSeedPackUi(packId: ActSeedPackId): ActSeedPackUi {
  return ACT_SEED_PACK_UI[packId] ?? ACT_SEED_PACK_UI['starter-acts'];
}

export function actSeedModeUi(mode: ActSeedMode): ActSeedModeUi {
  return ACT_SEED_MODES.find((entry) => entry.id === mode) ?? ACT_SEED_MODES[0];
}
