import { describe, it, expect } from 'vitest';
import type { Fixture } from '../store';
import {
  collectTrackerLaneChannels,
  getLaneForChannelType,
  isMovingHeadFixture,
} from './trackerFixtureRoles';

const mover: Fixture = {
  id: 'm1',
  name: 'Spot 1',
  type: 'Mover',
  startAddress: 1,
  tags: ['MOVING HEAD'],
  channels: [
    { name: 'Pan', type: 'pan' },
    { name: 'Tilt', type: 'tilt' },
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
    { name: 'Gobo', type: 'gobo_wheel' },
    { name: 'Color', type: 'color_wheel' },
  ],
};

const par: Fixture = {
  id: 'p1',
  name: 'Par 1',
  type: 'RGB Wash',
  startAddress: 20,
  channels: [
    { name: 'R', type: 'red' },
    { name: 'G', type: 'green' },
    { name: 'B', type: 'blue' },
  ],
};

describe('trackerFixtureRoles', () => {
  it('detects moving heads', () => {
    expect(isMovingHeadFixture(mover)).toBe(true);
    expect(isMovingHeadFixture(par)).toBe(false);
  });

  it('collects pan/tilt channels for all fixtures', () => {
    const ch = collectTrackerLaneChannels([mover, par], 'pan_tilt', 'all', []);
    expect(ch).toContain(0);
    expect(ch).toContain(1);
    expect(ch).not.toContain(19);
  });

  it('collects gobo only on movers', () => {
    const ch = collectTrackerLaneChannels([mover, par], 'gobo', 'all', []);
    expect(ch).toEqual([4]);
  });

  it('collects rgb from par and mover', () => {
    const ch = collectTrackerLaneChannels([mover, par], 'color_rgb', 'all', []);
    expect(ch).toContain(3);
    expect(ch).toContain(19);
    expect(ch).toContain(20);
  });

  it('scopes to selected fixtures', () => {
    const ch = collectTrackerLaneChannels([mover, par], 'color_rgb', 'selected', ['p1']);
    expect(ch).toEqual([19, 20, 21]);
  });

  it('maps channel types to lanes', () => {
    expect(getLaneForChannelType('pan')).toBe('pan_tilt');
    expect(getLaneForChannelType('gobo_wheel')).toBe('gobo');
    expect(getLaneForChannelType('red')).toBe('color_rgb');
  });
});
