import { describe, expect, it } from 'vitest';
import {
  findMovementSpeedTargets,
  movementSpeedDmxValue,
} from './movementSpeedChannels';

const mover = {
  name: 'Mover',
  startAddress: 20,
  channels: [
    { name: 'Pan', type: 'pan' },
    { name: 'Tilt', type: 'tilt' },
    { name: 'Pan/Tilt Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: 'Fast to slow' }] },
    { name: 'Colour Speed', type: 'speed', ranges: [{ min: 0, max: 255, description: 'Colour wheel speed' }] },
  ],
};

describe('movementSpeedChannels', () => {
  it('finds movement speed channels without grabbing colour/effect speed channels', () => {
    const targets = findMovementSpeedTargets([{ fixture: mover }]);

    expect(targets).toHaveLength(1);
    expect(targets[0].dmxAddress).toBe(21);
    expect(targets[0].channelName).toBe('Pan/Tilt Speed');
  });

  it('maps a fast-to-slow fixture channel to a slowest-to-fastest UI slider', () => {
    const [target] = findMovementSpeedTargets([{ fixture: mover }]);

    expect(movementSpeedDmxValue(target, 0)).toBe(255);
    expect(movementSpeedDmxValue(target, 1)).toBe(0);
  });

  it('keeps slow-to-fast channels in normal slider direction', () => {
    const [target] = findMovementSpeedTargets([{
      fixture: {
        name: 'Mover',
        startAddress: 1,
        channels: [
          { name: 'Pan', type: 'pan' },
          { name: 'Tilt', type: 'tilt' },
          { name: 'Movement Speed', type: 'speed', ranges: [{ min: 10, max: 200, description: 'Slow to fast' }] },
        ],
      },
    }]);

    expect(movementSpeedDmxValue(target, 0)).toBe(10);
    expect(movementSpeedDmxValue(target, 1)).toBe(200);
  });
});
