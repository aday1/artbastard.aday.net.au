import { describe, expect, it } from 'vitest';
import type { Fixture, Scene } from '../store';
import {
  SCENE_SEED_GENERATOR_ID,
  generateSeededSceneList,
} from './sceneSeedGenerator';

const rgbPar: Fixture = {
  id: 'par-1',
  name: 'RGB Par 1',
  type: 'RGB Wash',
  startAddress: 1,
  channels: [
    { name: 'Red', type: 'red' },
    { name: 'Green', type: 'green' },
    { name: 'Blue', type: 'blue' },
    { name: 'Dimmer', type: 'dimmer' },
  ],
};

const mover: Fixture = {
  id: 'mover-1',
  name: 'Mover 1',
  type: 'Moving Head Spot',
  startAddress: 20,
  tags: ['MOVING HEAD'],
  channels: [
    { name: 'Pan', type: 'pan' },
    { name: 'Tilt', type: 'tilt' },
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Gobo Wheel', type: 'gobo_wheel', ranges: [
      { min: 0, max: 15, description: 'Open' },
      { min: 16, max: 47, description: 'Dots' },
      { min: 48, max: 79, description: 'Lines' },
    ] },
    { name: 'Gobo Rotation', type: 'gobo_rotation' },
    { name: 'Prism', type: 'prism' },
    { name: 'Strobe', type: 'strobe' },
    { name: 'Lamp', type: 'lamp' },
    { name: 'Reset', type: 'reset' },
  ],
};

function handmadeScene(name = 'APC40 Deck A 01'): Scene {
  return {
    name,
    oscAddress: '/scene/handmade',
    channelValues: new Array(512).fill(3),
  };
}

describe('sceneSeedGenerator', () => {
  it('does not generate scenes before fixtures exist', () => {
    const result = generateSeededSceneList([], [], { packId: 'smart-starter-40' });

    expect(result.generatedScenes).toHaveLength(0);
    expect(result.disabledReason).toMatch(/fixtures/i);
  });

  it('creates compact APC40 Deck A scenes with valid 512-channel snapshots', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'compact-starter',
      target: 'deck-a',
      includeAutomation: true,
    });

    expect(result.generatedScenes).toHaveLength(16);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 01');
    expect(result.generatedScenes[15].name).toBe('APC40 Deck A 16');
    expect(result.generatedScenes.every((scene) => scene.channelValues.length === 512)).toBe(true);
    expect(result.generatedScenes.flatMap((scene) => scene.channelValues).every((value) => Number.isInteger(value) && value >= 0 && value <= 255)).toBe(true);
  });

  it('fills smart A+B packs across both decks', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-ab-80',
      target: 'decks-a-b',
      includeAutomation: true,
    });

    expect(result.generatedScenes).toHaveLength(80);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 01');
    expect(result.generatedScenes[39].name).toBe('APC40 Deck A 40');
    expect(result.generatedScenes[40].name).toBe('APC40 Deck B 01');
    expect(result.generatedScenes[79].name).toBe('APC40 Deck B 40');
  });

  it('uses fixture roles for color, dimmer, movement, and gobo looks', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: false,
    });

    const redSlow = result.generatedScenes.find((scene) => scene.seed?.templateId === 'red-slow');
    const goboTexture = result.generatedScenes.find((scene) => scene.seed?.templateId === 'gobo-texture');

    expect(redSlow?.channelValues[0]).toBe(255);
    expect(redSlow?.channelValues[1]).toBe(0);
    expect(redSlow?.channelValues[3]).toBeGreaterThan(0);
    expect(goboTexture?.channelValues[19]).toBe(127);
    expect(goboTexture?.channelValues[20]).toBe(127);
    expect(goboTexture?.channelValues[22]).toBeGreaterThan(0);
  });

  it('adds timeline automation only when requested and supported', () => {
    const automated = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: true,
    });
    const staticOnly = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: false,
    });

    expect(automated.generatedScenes.some((scene) => scene.timeline?.enabled)).toBe(true);
    expect(staticOnly.generatedScenes.some((scene) => scene.timeline?.enabled)).toBe(false);
  });

  it('never writes unsafe lamp or reset channels', () => {
    const result = generateSeededSceneList([mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: true,
    });

    expect(result.generatedScenes.every((scene) => scene.channelValues[26] === 0)).toBe(true);
    expect(result.generatedScenes.every((scene) => scene.channelValues[27] === 0)).toBe(true);
  });

  it('replaces generated seed scenes while preserving handmade slot collisions', () => {
    const first = generateSeededSceneList([rgbPar], [], {
      packId: 'compact-starter',
      target: 'deck-a',
      includeAutomation: false,
    });
    const existingGenerated = first.generatedScenes[1];
    const handmade = handmadeScene();

    const reseeded = generateSeededSceneList([rgbPar, mover], [handmade, existingGenerated], {
      packId: 'compact-starter',
      target: 'deck-a',
      includeAutomation: true,
    });

    expect(reseeded.skipped).toBe(1);
    expect(reseeded.refreshed).toBe(1);
    expect(reseeded.scenes.find((scene) => scene.name === handmade.name)).toBe(handmade);
    expect(reseeded.scenes.find((scene) => scene.name === existingGenerated.name)?.seed?.generatedBy).toBe(SCENE_SEED_GENERATOR_ID);
  });
});
