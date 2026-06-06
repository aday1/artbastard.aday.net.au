import { describe, expect, it } from 'vitest';
import {
  buildShowPatchPlan,
  formatPatchCsv,
  formatDipSwitchAddress,
  formatPatchSheet,
  type ShowBuilderTemplate,
} from './showPlan';
import { fixtureLibraryEntries } from '../library';

const laserTemplate: ShowBuilderTemplate = {
  id: 'laser-twinkler',
  catalogId: 'AB-FIX-001',
  templateName: 'Twinkling Laser Series RGY',
  defaultNamePrefix: 'Twinkling Laser RGY',
  type: 'Laser',
  tags: ['LASER'],
  addressing: {
    method: 'dip-switch',
    addressRange: {
      min: 1,
      max: 511,
      switches: [
        { switch: 1, value: 1 },
        { switch: 2, value: 2 },
        { switch: 3, value: 4 },
        { switch: 4, value: 8 },
        { switch: 5, value: 16 },
        { switch: 6, value: 32 },
        { switch: 7, value: 64 },
        { switch: 8, value: 128 },
        { switch: 9, value: 256 },
      ],
    },
    modeSwitches: [
      {
        description: 'DMX or slave mode',
        states: { 10: 0 },
      },
    ],
  },
  modes: [
    {
      name: '5-channel mode',
      channels: 5,
      channelData: [
        { name: 'Mode', type: 'macro' },
        { name: 'Rotation', type: 'effect' },
        { name: 'Speed', type: 'speed' },
        { name: 'Twinkle', type: 'speed' },
        { name: 'Colour', type: 'color_wheel' },
      ],
    },
  ],
};

const moverTemplate: ShowBuilderTemplate = {
  id: 'minibeam-moving-head',
  catalogId: 'AB-FIX-002',
  templateName: 'MiniBeam Moving Head Spot',
  defaultNamePrefix: 'MiniBeam',
  type: 'Moving Head Spot',
  tags: ['MOVING HEAD'],
  modes: [
    {
      name: '18-channel mode',
      channels: 18,
      channelData: Array.from({ length: 18 }, (_, index) => ({
        name: `Channel ${index + 1}`,
        type: index === 0 ? 'color_wheel' : 'other',
      })),
    },
  ],
};

describe('show patch planner', () => {
  it('generates sequential addresses with a configurable gap', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 2, groupName: 'Laser Pair' }],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 1, avoidExisting: true }
    );

    expect(plan.errors).toEqual([]);
    expect(plan.fixtures.map((fixture) => [fixture.startAddress, fixture.endAddress])).toEqual([
      [1, 5],
      [7, 11],
    ]);
    expect(plan.groups).toEqual([
      expect.objectContaining({ name: 'Laser Pair', fixtureCount: 2, startAddress: 1, endAddress: 11 }),
    ]);
    expect(plan.totalChannels).toBe(10);
  });

  it('skips existing occupied addresses when no hard row address is requested', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 1, groupName: 'Laser' }],
      [{ id: 'existing', name: 'Front Wash', startAddress: 1, channelCount: 20 }],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: true }
    );

    expect(plan.fixtures[0].startAddress).toBe(21);
  });

  it('lets duplicate fixture types split across named address blocks and groups', () => {
    const plan = buildShowPatchPlan(
      [moverTemplate],
      [
        { id: 'front', templateId: 'minibeam-moving-head', quantity: 2, groupName: 'Front Movers', startAddress: 1 },
        { id: 'rear', templateId: 'minibeam-moving-head', quantity: 2, groupName: 'Rear Movers', startAddress: 101 },
      ],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: true }
    );

    expect(plan.errors).toEqual([]);
    expect(plan.groups.map((group) => [group.name, group.fixtureCount])).toEqual([
      ['Front Movers', 2],
      ['Rear Movers', 2],
    ]);
    expect(plan.fixtures.map((fixture) => [fixture.groupName, fixture.startAddress, fixture.endAddress])).toEqual([
      ['Front Movers', 1, 18],
      ['Front Movers', 19, 36],
      ['Rear Movers', 101, 118],
      ['Rear Movers', 119, 136],
    ]);
  });

  it('reports hard-start address collisions instead of silently moving the requested block', () => {
    const plan = buildShowPatchPlan(
      [moverTemplate],
      [
        { id: 'front', templateId: 'minibeam-moving-head', quantity: 1, groupName: 'Front Movers', startAddress: 1 },
        { id: 'rear', templateId: 'minibeam-moving-head', quantity: 1, groupName: 'Rear Movers', startAddress: 10 },
      ],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: true }
    );

    expect(plan.fixtures).toHaveLength(1);
    expect(plan.errors[0]).toContain('overlapping');
  });

  it('reports universe overflow instead of generating invalid addresses', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 2 }],
      [],
      { showName: 'Beta', startAddress: 508, gapChannels: 0, avoidExisting: false }
    );

    expect(plan.fixtures).toHaveLength(1);
    expect(plan.errors[0]).toContain('does not fit');
  });

  it('formats setup sheets operators can copy or export', () => {
    const plan = buildShowPatchPlan(
      [laserTemplate],
      [{ templateId: 'laser-twinkler', quantity: 1, groupName: 'Lasers' }],
      [],
      { showName: 'Beta', startAddress: 1, gapChannels: 0, avoidExisting: false }
    );

    expect(formatPatchSheet(plan)).toContain('Lasers | Lasers Twinkling Laser RGY 1 AB-FIX-001: DMX 1-5');
    expect(formatPatchSheet(plan)).toContain('Set address 1: DIP 1 ON; 2, 3, 4, 5, 6, 7, 8, 9 OFF');
    expect(formatPatchSheet(plan)).toContain('DMX or slave mode: S10 OFF');
    expect(formatPatchCsv(plan)).toContain('"Group","Fixture","Catalog ID"');
    expect(formatPatchCsv(plan)).toContain('"Physical Address","Mode Switches"');
    expect(plan.warnings).toContain('Laser fixtures require physical safety checks before output is enabled.');
  });

  it('formats DIP switch addresses for documented addressable fixtures', () => {
    expect(formatDipSwitchAddress(25, laserTemplate.addressing)).toBe(
      'Set address 25: DIP 1, 4, 5 ON; 2, 3, 6, 7, 8, 9 OFF'
    );
  });

  it('can create addressable plan rows for every canonical fixture profile', () => {
    const plan = buildShowPatchPlan(
      fixtureLibraryEntries,
      fixtureLibraryEntries.map((entry, index) => ({
        id: entry.id,
        templateId: entry.id,
        quantity: 1,
        groupName: entry.catalogId,
        startAddress: 1 + index * 30,
      })),
      [],
      { showName: 'Canonical', startAddress: 1, gapChannels: 0, avoidExisting: true }
    );

    expect(plan.errors).toEqual([]);
    expect(plan.fixtures).toHaveLength(fixtureLibraryEntries.length);
    expect(plan.fixtures.every((fixture) => fixture.addressInstruction.includes(String(fixture.startAddress)))).toBe(true);
    expect(plan.fixtures.map((fixture) => fixture.catalogId)).toEqual(
      fixtureLibraryEntries.map((entry) => entry.catalogId)
    );
  });
});
