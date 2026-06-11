import { describe, expect, it } from 'vitest';
import type { Fixture, Group, PlacedFixture } from '../store';
import {
  cleanupAfterFixtureDelete,
  createFixtureFromTemplate,
  fallbackStagePosition,
  findNextAvailableDmxStart,
  fixtureIdsToIndices,
  fixtureIndicesToIds,
  normalizeFixtureLayout,
  suggestStageMapGroups,
} from './stageMap';
import type { FixtureTemplate } from '../store';

const makeFixture = (id: string, startAddress: number, channelCount = 4): Fixture => ({
  id,
  name: id,
  type: 'RGB Wash',
  startAddress,
  channels: Array.from({ length: channelCount }, (_, index) => ({
    name: `Channel ${index + 1}`,
    type: index === 0 ? 'dimmer' : 'other',
  })),
});

describe('stageMap utilities', () => {
  it('normalizes existing and fallback fixture positions into the 1000x600 stage space', () => {
    const fixtures = [makeFixture('front-left', 1), makeFixture('front-right', 10)];
    const layout = normalizeFixtureLayout(fixtures, [
      {
        id: 'legacy',
        fixtureId: 'front-left',
        x: 0.25,
        y: 0.5,
        rotation: 15,
        scale: 1,
        startAddress: 1,
        dmxAddress: 1,
        type: 'RGB Wash',
      } as PlacedFixture,
    ]);

    expect(layout[0]).toMatchObject({
      fixtureId: 'front-left',
      x: 250,
      y: 300,
      rotation: 15,
    });
    expect(layout[1]).toMatchObject({
      fixtureId: 'front-right',
      ...fallbackStagePosition(1, 2),
    });
  });

  it('finds the next free DMX start address when dropped fixtures are patched', () => {
    const fixtures = [
      makeFixture('wash-1', 1, 8),
      makeFixture('mover-1', 20, 12),
    ];

    expect(findNextAvailableDmxStart(fixtures, 6)).toBe(9);
    expect(findNextAvailableDmxStart(fixtures, 10, 20)).toBe(32);
  });

  it('creates fixtures from library templates using the selected DMX mode', () => {
    const template: FixtureTemplate = {
      id: 'tiny-wash',
      templateName: 'Tiny Wash',
      defaultNamePrefix: 'Wash',
      type: 'Wash',
      modes: [
        {
          name: '8CH',
          channels: 8,
          channelData: [
            { name: 'Dimmer', type: 'dimmer' },
            { name: 'Red', type: 'red' },
          ],
        },
      ],
      tags: ['RGB'],
    };

    const fixture = createFixtureFromTemplate(template, 42, 3);
    expect(fixture).toMatchObject({
      name: 'Wash 3',
      type: 'Wash',
      mode: '8CH',
      startAddress: 42,
      tags: ['RGB'],
    });
    expect(fixture.channels).toHaveLength(2);
  });

  it('converts selected fixture IDs to group indices and back', () => {
    const fixtures = [makeFixture('a', 1), makeFixture('b', 10), makeFixture('c', 20)];
    expect(fixtureIdsToIndices(fixtures, ['c', 'a'])).toEqual([0, 2]);
    expect(fixtureIndicesToIds(fixtures, [2, 0])).toEqual(['c', 'a']);
  });

  it('cleans group indices and fixture layout when a fixture is deleted', () => {
    const fixtures = [makeFixture('a', 1), makeFixture('b', 10), makeFixture('c', 20)];
    const groups: Group[] = [
      {
        id: 'all',
        name: 'All',
        fixtureIndices: [0, 1, 2],
        lastStates: [],
        isMuted: false,
        isSolo: false,
        masterValue: 255,
      },
      {
        id: 'only-b',
        name: 'Only B',
        fixtureIndices: [1],
        lastStates: [],
        isMuted: false,
        isSolo: false,
        masterValue: 255,
      },
    ];
    const layout = fixtures.map((fixture) => ({ fixtureId: fixture.id } as PlacedFixture));

    const cleaned = cleanupAfterFixtureDelete(fixtures, groups, layout, 'b');
    expect(cleaned.groups).toHaveLength(1);
    expect(cleaned.groups[0].fixtureIndices).toEqual([0, 1]);
    expect(cleaned.fixtureLayout.map((item) => item.fixtureId)).toEqual(['a', 'c']);
  });

  it('suggests stage-left/right and upstage/downstage groups from layout positions', () => {
    const fixtures = [makeFixture('left', 1), makeFixture('right', 10), makeFixture('down', 20)];
    const layout = normalizeFixtureLayout(fixtures, [
      { fixtureId: 'left', x: 100, y: 100 } as PlacedFixture,
      { fixtureId: 'right', x: 900, y: 100 } as PlacedFixture,
      { fixtureId: 'down', x: 500, y: 520 } as PlacedFixture,
    ]);

    const suggestions = suggestStageMapGroups(fixtures, layout);
    expect(suggestions.find((item) => item.name === 'Stage Left')?.fixtureIndices).toEqual([0]);
    expect(suggestions.find((item) => item.name === 'Stage Right')?.fixtureIndices).toEqual([1]);
    expect(suggestions.find((item) => item.name === 'Downstage')?.fixtureIndices).toEqual([2]);
  });
});
