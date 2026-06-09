import type { Act, ActStep, ActTrigger, Scene, TimelineMarker } from '../store';

export const ACT_SEED_GENERATOR_ID = 'artbastard-act-seeder';
export const ACT_SEED_GENERATOR_VERSION = 1;

export type ActSeedPackId = 'starter-acts' | 'performance-acts';

export interface ActSeedOptions {
  packId: ActSeedPackId;
  includeTriggers: boolean;
}

export interface ActSeedSummary {
  acts: Act[];
  generatedActs: Act[];
  created: number;
  refreshed: number;
  skipped: number;
  sceneCount: number;
  disabledReason?: string;
}

interface ActSeedStepTemplate {
  sceneKeys: string[];
  duration: number;
  transitionDuration: number;
  notes?: string;
}

interface ActSeedTemplate {
  id: string;
  label: string;
  description: string;
  loopMode: Act['loopMode'];
  playbackMode: Act['playbackMode'];
  syncToBpm?: boolean;
  bpmMultiplier?: number;
  steps: ActSeedStepTemplate[];
}

export const ACT_SEED_PACKS: Array<{ id: ActSeedPackId; label: string; description: string }> = [
  {
    id: 'starter-acts',
    label: 'Starter ACTS 5',
    description: 'Creates five optional ACTS for the APC40 scene-launch buttons: color, wash, movement, gobo, and strobe.',
  },
  {
    id: 'performance-acts',
    label: 'Performance ACTS 8',
    description: 'Creates eight optional show-section ACTS with longer builds, loops, gobo passes, strobe breaks, and finale looks.',
  },
];

const STARTER_TEMPLATES: ActSeedTemplate[] = [
  {
    id: 'color-warmup',
    label: 'Color Warmup',
    description: 'Blackout into warm and cool washes, then full open.',
    loopMode: 'none',
    playbackMode: 'once',
    steps: [
      step(['blackout', 'blackout hit'], 2000, 250, 'Start clean.'),
      step(['warm-wash', 'warm wash', 'amber glow'], 7000, 1200, 'Bring the rig up warm.'),
      step(['cool-wash', 'cool wash', 'cyan wash'], 7000, 1200, 'Cross into cool wash.'),
      step(['full-open', 'full open', 'finale full'], 4000, 800, 'Confirm all fixtures are responding.'),
    ],
  },
  {
    id: 'red-slow',
    label: 'Red Slow',
    description: 'A slow red look with a gobo accent and a short red hit.',
    loopMode: 'loop',
    playbackMode: 'loop',
    syncToBpm: true,
    bpmMultiplier: 16,
    steps: [
      step(['red-slow', 'red slow'], 11000, 1200, 'Slow red base.'),
      step(['warm-gobo-slow', 'warm gobo slow', 'gobo-rotate-slow'], 9000, 1400, 'Add texture.'),
      step(['red-fast', 'red fast', 'strobe-color'], 4500, 500, 'Short energy lift.'),
      step(['red-slow', 'red slow'], 6500, 900, 'Return to the slow red base.'),
    ],
  },
  {
    id: 'wash-fast',
    label: 'Wash Fast',
    description: 'Wash slow into fast movement and color chase.',
    loopMode: 'loop',
    playbackMode: 'loop',
    syncToBpm: true,
    bpmMultiplier: 8,
    steps: [
      step(['wash-slow', 'wash slow', 'warm-wash'], 6000, 900, 'Slow wash entry.'),
      step(['wash-fast', 'wash fast', 'cool-wash'], 7000, 600, 'Fast wash pass.'),
      step(['color-chase', 'color chase', 'move-fast'], 6000, 500, 'Movement and color lift.'),
      step(['wash-fast', 'wash fast', 'cyan-wash'], 5000, 500, 'Keep the wash moving.'),
    ],
  },
  {
    id: 'gobo-texture',
    label: 'Gobo Texture',
    description: 'Spot, gobo texture, slow rotate, then prism beam.',
    loopMode: 'loop',
    playbackMode: 'loop',
    steps: [
      step(['center-spot', 'center spot', 'gobo-open'], 5000, 1000, 'Center the look.'),
      step(['gobo-texture', 'gobo texture'], 9000, 1200, 'Bring in texture.'),
      step(['gobo-rotate-slow', 'gobo rotate slow', 'warm-gobo-slow'], 10000, 1400, 'Let the gobo move.'),
      step(['prism-beam', 'prism beam', 'narrow-beam'], 6000, 900, 'Add prism/beam emphasis.'),
    ],
  },
  {
    id: 'strobe-move-90',
    label: 'Strobe Move 90',
    description: 'Blackout, strobe all, strobe with 90-degree movement, then release.',
    loopMode: 'none',
    playbackMode: 'once',
    steps: [
      step(['blackout', 'blackout hit'], 1500, 100, 'Punch down.'),
      step(['strobe-all', 'strobe all'], 2500, 100, 'All-fixture strobe.'),
      step(['strobe-move-90', 'strobe all move 90', 'move-90'], 4500, 250, 'Strobe with 90-degree move.'),
      step(['blackout-hit', 'blackout hit', 'blackout'], 1200, 100, 'Release the hit.'),
      step(['full-open', 'finale-full', 'full open'], 2500, 600, 'Return to visibility.'),
    ],
  },
];

const PERFORMANCE_TEMPLATES: ActSeedTemplate[] = [
  ...STARTER_TEMPLATES,
  {
    id: 'opening-build',
    label: 'Opening Build',
    description: 'A longer opener from blackout through color, movement, texture, and full finale.',
    loopMode: 'none',
    playbackMode: 'once',
    syncToBpm: true,
    bpmMultiplier: 32,
    steps: [
      step(['blackout', 'blackout hit'], 3000, 300, 'House down.'),
      step(['amber-glow', 'warm-wash', 'warm wash'], 8000, 1800, 'Warm entry.'),
      step(['wash-slow', 'wash slow'], 9000, 1600, 'Slow wash build.'),
      step(['move-slow', 'move slow', 'left-sweep'], 9000, 1600, 'Start movement.'),
      step(['gobo-rotate-slow', 'gobo texture'], 9000, 1400, 'Add gobo motion.'),
      step(['finale-full', 'full-open'], 5000, 900, 'Open the full rig.'),
    ],
  },
  {
    id: 'movement-sweep',
    label: 'Movement Sweep',
    description: 'Left/right sweeps, fan spread, mirror sweep, and center reset.',
    loopMode: 'loop',
    playbackMode: 'loop',
    steps: [
      step(['left-sweep', 'left sweep'], 7000, 1000, 'Sweep left.'),
      step(['right-sweep', 'right sweep'], 7000, 1000, 'Sweep right.'),
      step(['fan-spread', 'fan spread'], 7000, 1100, 'Open the fan.'),
      step(['mirror-sweep', 'mirror sweep'], 8000, 1100, 'Mirror the rig.'),
      step(['center-spot', 'center spot'], 4500, 800, 'Return center.'),
    ],
  },
  {
    id: 'finale-punch',
    label: 'Finale Punch',
    description: 'Fast color, strobe, prism, full open, blackout hit, finale full.',
    loopMode: 'none',
    playbackMode: 'once',
    steps: [
      step(['color-chase', 'color chase', 'wash-fast'], 6000, 500, 'Fast color.'),
      step(['strobe-color', 'strobe color', 'strobe-all'], 2500, 150, 'Color strobe.'),
      step(['prism-beam', 'prism beam'], 4500, 400, 'Prism hit.'),
      step(['full-open', 'full open'], 3000, 500, 'Open up.'),
      step(['blackout-hit', 'blackout hit'], 900, 100, 'Drop.'),
      step(['finale-full', 'finale full'], 5000, 400, 'Final push.'),
    ],
  },
];

function step(
  sceneKeys: string[],
  duration: number,
  transitionDuration: number,
  notes?: string
): ActSeedStepTemplate {
  return { sceneKeys, duration, transitionDuration, notes };
}

function templatesForPack(packId: ActSeedPackId): ActSeedTemplate[] {
  return packId === 'performance-acts' ? PERFORMANCE_TEMPLATES : STARTER_TEMPLATES;
}

function normalize(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'act';
}

function searchableSceneText(scene: Scene): string[] {
  return [
    scene.name,
    scene.oscAddress,
    scene.seed?.label,
    scene.seed?.templateId,
    scene.seed ? `${scene.seed.deck}${scene.seed.slot}` : undefined,
  ].filter(Boolean).map((value) => normalize(value));
}

function findSceneForStep(scenes: Scene[], sceneKeys: string[], fallbackIndex: number, usedSceneNames: Set<string>): Scene | undefined {
  const normalizedKeys = sceneKeys.map((key) => normalize(key)).filter(Boolean);
  const matches = scenes.filter((scene) => {
    const fields = searchableSceneText(scene);
    return normalizedKeys.some((key) => fields.some((field) => field.includes(key) || key.includes(field)));
  });

  return matches.find((scene) => !usedSceneNames.has(scene.name))
    ?? matches[0]
    ?? scenes[fallbackIndex % scenes.length];
}

function buildSteps(template: ActSeedTemplate, scenes: Scene[]): ActStep[] {
  const usedSceneNames = new Set<string>();
  let cursor = 0;

  return template.steps.reduce<ActStep[]>((steps, stepTemplate, index) => {
    const scene = findSceneForStep(scenes, stepTemplate.sceneKeys, index, usedSceneNames);
    if (!scene) return steps;
    usedSceneNames.add(scene.name);

    const stepId = `seed-step-${template.id}-${index + 1}`;
    const stepData: ActStep = {
      id: stepId,
      sceneName: scene.name,
      duration: stepTemplate.duration,
      startTime: cursor,
      transitionDuration: stepTemplate.transitionDuration,
      notes: stepTemplate.notes,
    };
    cursor += stepTemplate.duration;
    return [...steps, stepData];
  }, []);
}

function totalDurationForSteps(steps: ActStep[]): number {
  return steps.reduce((max, step) => Math.max(max, (step.startTime ?? 0) + step.duration), 0);
}

function markersForSteps(steps: ActStep[]): TimelineMarker[] {
  return steps.map((step, index) => ({
    id: `seed-marker-${index + 1}`,
    time: step.startTime ?? 0,
    name: step.notes || `Step ${index + 1}`,
  }));
}

function buildTriggers(actId: string, template: ActSeedTemplate, includeTriggers: boolean): ActTrigger[] {
  if (!includeTriggers) return [];
  return [
    {
      id: `${actId}_osc_play`,
      type: 'osc',
      address: `/act/seed/${slug(template.label)}/play`,
      action: 'play',
      enabled: true,
    },
    {
      id: `${actId}_osc_stop`,
      type: 'osc',
      address: `/act/seed/${slug(template.label)}/stop`,
      action: 'stop',
      enabled: true,
    },
  ];
}

function isSeedAct(act: Act | undefined): boolean {
  return act?.seed?.generatedBy === ACT_SEED_GENERATOR_ID;
}

function buildAct(
  template: ActSeedTemplate,
  scenes: Scene[],
  options: ActSeedOptions,
  slot: number,
  existing?: Act
): Act {
  const actId = `seed-act-${options.packId}-${template.id}`;
  const name = `ACT Seed ${String(slot).padStart(2, '0')} - ${template.label}`;
  const steps = buildSteps(template, scenes);
  const totalDuration = totalDurationForSteps(steps);
  const now = Date.now();

  return {
    id: actId,
    name,
    description: `${template.description} Optional seed ACT; edit, delete, or ignore it whenever you want a scratch build.`,
    steps,
    loopMode: template.loopMode,
    totalDuration,
    triggers: buildTriggers(actId, template, options.includeTriggers),
    timelineEvents: [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    playbackMode: template.playbackMode,
    playbackSpeed: 1,
    syncToBpm: template.syncToBpm,
    bpmMultiplier: template.bpmMultiplier,
    markers: markersForSteps(steps),
    seed: {
      generatedBy: ACT_SEED_GENERATOR_ID,
      generatorVersion: ACT_SEED_GENERATOR_VERSION,
      packId: options.packId,
      templateId: template.id,
      slot,
      label: template.label,
    },
  };
}

export function generateSeededActList(
  scenes: Scene[],
  existingActs: Act[],
  partialOptions: Partial<ActSeedOptions> = {}
): ActSeedSummary {
  const options: ActSeedOptions = {
    packId: 'starter-acts',
    includeTriggers: true,
    ...partialOptions,
  };

  if (scenes.length === 0) {
    return {
      acts: existingActs,
      generatedActs: [],
      created: 0,
      refreshed: 0,
      skipped: 0,
      sceneCount: 0,
      disabledReason: 'Create or seed scenes before seeding ACTS.',
    };
  }

  const existingById = new Map(existingActs.map((act) => [act.id, act]));
  const existingByName = new Map(existingActs.map((act) => [act.name, act]));
  const generatedActs = templatesForPack(options.packId).map((template, index) => {
    const actId = `seed-act-${options.packId}-${template.id}`;
    return buildAct(template, scenes, options, index + 1, existingById.get(actId));
  });

  const blocked = generatedActs.filter((act) => {
    const existingByGeneratedId = existingById.get(act.id);
    const existingByGeneratedName = existingByName.get(act.name);
    return Boolean(
      (existingByGeneratedId && !isSeedAct(existingByGeneratedId)) ||
      (existingByGeneratedName && !isSeedAct(existingByGeneratedName))
    );
  });

  const allowed = generatedActs.filter((act) => !blocked.some((blockedAct) => blockedAct.id === act.id));
  const allowedIds = new Set(allowed.map((act) => act.id));
  const allowedNames = new Set(allowed.map((act) => act.name));
  const preservedActs = existingActs.filter((act) => {
    if (!isSeedAct(act)) return true;
    return !allowedIds.has(act.id) && !allowedNames.has(act.name);
  });
  const refreshed = allowed.filter((act) => isSeedAct(existingById.get(act.id)) || isSeedAct(existingByName.get(act.name))).length;

  return {
    acts: [...preservedActs, ...allowed],
    generatedActs: allowed,
    created: allowed.length - refreshed,
    refreshed,
    skipped: blocked.length,
    sceneCount: scenes.length,
  };
}

