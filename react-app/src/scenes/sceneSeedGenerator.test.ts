import { describe, expect, it } from 'vitest';
import type { Fixture, Scene } from '../store';
import {
  SCENE_SEED_GENERATOR_ID,
  generateSeededSceneList,
  captureSelectionToApcSlot,
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

  it('fills essential A+B packs with 14 slots per deck', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'essential-ab-28',
      target: 'decks-a-b',
      includeAutomation: false,
    });

    expect(result.generatedScenes).toHaveLength(28);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 01');
    expect(result.generatedScenes[13].name).toBe('APC40 Deck A 14');
    expect(result.generatedScenes[14].name).toBe('APC40 Deck B 01');
    expect(result.generatedScenes[27].name).toBe('APC40 Deck B 14');
    expect(result.generatedScenes.every((scene) => scene.seed?.packId === 'essential-ab-28')).toBe(true);
  });

  it('fills operator rows 3-5 on both decks without dimmer or gobo writes', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'operator-rows-ab-48',
      target: 'decks-a-b',
      includeAutomation: false,
    });

    expect(result.generatedScenes).toHaveLength(48);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 17');
    expect(result.generatedScenes[7].name).toBe('APC40 Deck A 24');
    expect(result.generatedScenes[8].name).toBe('APC40 Deck A 25');
    expect(result.generatedScenes[15].name).toBe('APC40 Deck A 32');
    expect(result.generatedScenes[16].name).toBe('APC40 Deck A 33');
    expect(result.generatedScenes[23].name).toBe('APC40 Deck A 40');
    expect(result.generatedScenes[24].name).toBe('APC40 Deck B 17');
    expect(result.generatedScenes[47].name).toBe('APC40 Deck B 40');

    const ptCenter = result.generatedScenes.find((scene) => scene.seed?.templateId === 'pt-center');
    const colRed = result.generatedScenes.find((scene) => scene.seed?.templateId === 'col-red');
    const mixRed = result.generatedScenes.find((scene) => scene.seed?.templateId === 'mix-red-center');

    expect(ptCenter?.channelValues[19]).toBe(127);
    expect(ptCenter?.channelValues[20]).toBe(127);
    expect(ptCenter?.channelValues[0]).toBe(0);
    expect(ptCenter?.channelValues[3]).toBe(0);
    expect(ptCenter?.channelValues[22]).toBe(0);

    expect(colRed?.channelValues[0]).toBe(255);
    expect(colRed?.channelValues[19]).toBe(0);
    expect(colRed?.channelValues[3]).toBe(0);

    expect(mixRed?.channelValues[0]).toBe(255);
    expect(mixRed?.channelValues[19]).toBe(127);
    expect(mixRed?.channelValues[22]).toBe(0);
  });

  it('adds operator row automation only when requested', () => {
    const automated = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'operator-rows-ab-48',
      target: 'decks-a-b',
      includeAutomation: true,
    });
    const staticOnly = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'operator-rows-ab-48',
      target: 'decks-a-b',
      includeAutomation: false,
    });

    expect(automated.generatedScenes.some((scene) => scene.timeline?.enabled)).toBe(true);
    expect(staticOnly.generatedScenes.some((scene) => scene.timeline?.enabled)).toBe(false);
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

  it('can seed scenes with strobe looks and strobe channel animation disabled', () => {
    const result = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: true,
      avoidStrobe: true,
    });

    expect(result.generatedScenes.some((scene) => /strobe/i.test(scene.seed?.templateId || ''))).toBe(false);
    expect(result.generatedScenes.every((scene) => scene.channelValues[25] === 0)).toBe(true);
    expect(result.generatedScenes.every((scene) => (
      scene.timeline?.keyframes.every((keyframe) => keyframe.channelValues[25] === undefined) ?? true
    ))).toBe(true);
  });

  it('removes previously generated strobe scenes when reseeding in no-strobe mode', () => {
    const first = generateSeededSceneList([rgbPar, mover], [], {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: true,
    });
    const reseeded = generateSeededSceneList([rgbPar, mover], first.scenes, {
      packId: 'smart-starter-40',
      target: 'deck-a',
      includeAutomation: true,
      avoidStrobe: true,
    });

    expect(first.scenes.some((scene) => /strobe/i.test(`${scene.seed?.templateId} ${scene.seed?.label}`))).toBe(true);
    expect(reseeded.scenes.some((scene) => /strobe/i.test(`${scene.seed?.templateId} ${scene.seed?.label}`))).toBe(false);
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

  it('seeds one refined look into a chosen APC slot', () => {
    const result = generateSeededSceneList([rgbPar], [], {
      mode: 'single-slot',
      packId: 'smart-starter-40',
      target: 'deck-a',
      deck: 'A',
      slot: 7,
      templateId: 'full-blue',
      includeAutomation: false,
      avoidStrobe: true,
    });

    expect(result.generatedScenes).toHaveLength(1);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 07');
    expect(result.generatedScenes[0].seed?.templateId).toBe('full-blue');
    expect(result.generatedScenes[0].channelValues.slice(0, 4)).toEqual([0, 20, 255, 255]);
  });

  it('captures selected fixture channels into one APC slot', () => {
    const dmxChannels = new Array(512).fill(0);
    dmxChannels[0] = 200;
    dmxChannels[1] = 40;
    dmxChannels[3] = 255;

    const result = captureSelectionToApcSlot([rgbPar], dmxChannels, [], {
      deck: 'A',
      slot: 3,
      selectedFixtureIds: [rgbPar.id],
    });

    expect(result.generatedScenes).toHaveLength(1);
    expect(result.generatedScenes[0].name).toBe('APC40 Deck A 03');
    expect(result.generatedScenes[0].channelValues[0]).toBe(200);
    expect(result.generatedScenes[0].channelValues[3]).toBe(255);
  });
});
