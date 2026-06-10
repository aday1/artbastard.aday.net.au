import { describe, expect, it } from 'vitest';
import { computeSceneDiff } from './sceneDiff';

const wash = {
  id: 'wash-1',
  name: 'Wash 1',
  type: 'RGB Wash',
  startAddress: 1,
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
    { name: 'Green', type: 'green' },
    { name: 'Blue', type: 'blue' },
  ],
};

const mover = {
  id: 'mover-1',
  name: 'Mover 1',
  type: 'Moving Head',
  startAddress: 5,
  channels: [
    { name: 'Pan', type: 'pan' },
    { name: 'Tilt', type: 'tilt' },
    { name: 'Dimmer', type: 'dimmer' },
  ],
};

const fixtures: any[] = [wash, mover];

const scene = (name: string, channelValues: number[]) => ({
  name,
  channelValues,
  oscAddress: `/scene/${name}`,
});

describe('computeSceneDiff', () => {
  it('returns empty diff when prev is null', () => {
    const diff = computeSceneDiff(null, scene('a', [200, 0, 0, 0, 0, 0, 0]), fixtures);
    expect(diff).toEqual({ changedChannels: [], addedFixtures: [], removedFixtures: [] });
  });

  it('flags an added fixture when previously dark', () => {
    const prev = scene('a', [200, 0, 0, 0, 0, 0, 0]); // wash lit, mover dark
    const next = scene('b', [200, 0, 0, 0, 0, 0, 180]); // wash lit, mover now lit
    const diff = computeSceneDiff(prev, next, fixtures);
    expect(diff.addedFixtures).toEqual(['mover-1']);
    expect(diff.removedFixtures).toEqual([]);
    expect(diff.changedChannels).toEqual([6]);
  });

  it('flags a removed fixture when previously lit and now dark', () => {
    const prev = scene('a', [200, 0, 0, 0, 0, 0, 180]);
    const next = scene('b', [200, 0, 0, 0, 0, 0, 0]);
    const diff = computeSceneDiff(prev, next, fixtures);
    expect(diff.addedFixtures).toEqual([]);
    expect(diff.removedFixtures).toEqual(['mover-1']);
  });

  it('returns empty diff when scenes share a name', () => {
    const a = scene('same', [200, 0, 0, 0]);
    const b = scene('same', [0, 0, 0, 0]);
    expect(computeSceneDiff(a, b, fixtures)).toEqual({
      changedChannels: [],
      addedFixtures: [],
      removedFixtures: [],
    });
  });
});
