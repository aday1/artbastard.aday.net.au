import { describe, expect, it } from 'vitest';
import type { Act, Scene } from '../store';
import {
  ACT_SEED_GENERATOR_ID,
  generateSeededActList,
} from './actSeedGenerator';

function scene(templateId: string, label: string, slot: number): Scene {
  return {
    name: `APC40 Deck A ${String(slot).padStart(2, '0')}`,
    oscAddress: `/scene/apc40/deck-a/${slot}`,
    channelValues: new Array(512).fill(0),
    seed: {
      generatedBy: 'artbastard-scene-seeder',
      generatorVersion: 1,
      packId: 'smart-starter-40',
      templateId,
      deck: 'A',
      slot,
      label,
      automated: true,
    },
  };
}

const seededScenes: Scene[] = [
  scene('blackout', 'Blackout', 1),
  scene('full-open', 'Full Open', 2),
  scene('warm-wash', 'Warm Wash', 3),
  scene('cool-wash', 'Cool Wash', 4),
  scene('red-slow', 'Red Slow', 5),
  scene('red-fast', 'Red Fast', 6),
  scene('wash-slow', 'Wash Slow', 7),
  scene('wash-fast', 'Wash Fast', 8),
  scene('color-chase', 'Color Chase', 9),
  scene('center-spot', 'Center Spot', 10),
  scene('gobo-texture', 'Gobo Texture', 11),
  scene('gobo-rotate-slow', 'Gobo Rotate Slow', 12),
  scene('prism-beam', 'Prism Beam', 13),
  scene('strobe-all', 'Strobe All', 14),
  scene('strobe-move-90', 'Strobe All Move 90', 15),
  scene('blackout-hit', 'Blackout Hit', 16),
  scene('finale-full', 'Finale Full', 17),
];

function handmadeAct(name = 'ACT Seed 01 - Color Warmup'): Act {
  return {
    id: 'handmade-act',
    name,
    description: 'User built act',
    steps: [],
    loopMode: 'none',
    totalDuration: 0,
    triggers: [],
    timelineEvents: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('actSeedGenerator', () => {
  it('does not generate ACTS before scenes exist', () => {
    const result = generateSeededActList([], [], { packId: 'starter-acts' });

    expect(result.generatedActs).toHaveLength(0);
    expect(result.disabledReason).toMatch(/scenes/i);
  });

  it('creates five starter ACTS that reference existing scene names', () => {
    const result = generateSeededActList(seededScenes, [], {
      packId: 'starter-acts',
      includeTriggers: true,
    });

    expect(result.generatedActs).toHaveLength(5);
    expect(result.generatedActs[0].name).toBe('ACT Seed 01 - Color Warmup');
    expect(result.generatedActs[4].name).toBe('ACT Seed 05 - Strobe Move 90');
    expect(result.generatedActs.every((act) => act.steps.length > 0)).toBe(true);
    expect(result.generatedActs.flatMap((act) => act.steps).every((step) => seededScenes.some((candidate) => candidate.name === step.sceneName))).toBe(true);
  });

  it('adds optional OSC triggers when requested', () => {
    const withTriggers = generateSeededActList(seededScenes, [], {
      packId: 'starter-acts',
      includeTriggers: true,
    });
    const withoutTriggers = generateSeededActList(seededScenes, [], {
      packId: 'starter-acts',
      includeTriggers: false,
    });

    expect(withTriggers.generatedActs[0].triggers).toHaveLength(2);
    expect(withTriggers.generatedActs[0].triggers[0].address).toBe('/act/seed/color-warmup/play');
    expect(withoutTriggers.generatedActs[0].triggers).toHaveLength(0);
  });

  it('creates eight performance ACTS for a larger optional seed pack', () => {
    const result = generateSeededActList(seededScenes, [], {
      packId: 'performance-acts',
      includeTriggers: false,
    });

    expect(result.generatedActs).toHaveLength(8);
    expect(result.generatedActs[5].name).toBe('ACT Seed 06 - Opening Build');
    expect(result.generatedActs[7].seed?.templateId).toBe('finale-punch');
  });

  it('preserves handmade ACT collisions and refreshes generated ACTS only', () => {
    const first = generateSeededActList(seededScenes.slice(0, 8), [], {
      packId: 'starter-acts',
      includeTriggers: false,
    });
    const generated = first.generatedActs[1];
    const handmade = handmadeAct();

    const reseeded = generateSeededActList(seededScenes, [handmade, generated], {
      packId: 'starter-acts',
      includeTriggers: true,
    });

    expect(reseeded.skipped).toBe(1);
    expect(reseeded.refreshed).toBe(1);
    expect(reseeded.acts.find((act) => act.name === handmade.name)).toBe(handmade);
    expect(reseeded.acts.find((act) => act.id === generated.id)?.seed?.generatedBy).toBe(ACT_SEED_GENERATOR_ID);
    expect(reseeded.acts.find((act) => act.id === generated.id)?.triggers).toHaveLength(2);
  });

  it('keeps total duration aligned with generated step timing', () => {
    const result = generateSeededActList(seededScenes, [], {
      packId: 'starter-acts',
      includeTriggers: false,
    });

    const act = result.generatedActs[0];
    const end = Math.max(...act.steps.map((step) => (step.startTime ?? 0) + step.duration));
    expect(act.totalDuration).toBe(end);
    expect(act.markers?.[0].time).toBe(0);
  });
});

