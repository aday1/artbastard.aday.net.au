import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetApc40XyCrosshairForTests,
  paintApc40Crosshair,
  setApc40XyCrosshairEnabled,
} from './apc40XyCrosshair';

describe('apc40XyCrosshair', () => {
  let output: { name: string; manufacturer: string; send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    output = { name: 'Akai APC40 Output', manufacturer: 'Akai', send: vi.fn() };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(() => Promise.resolve({ outputs: new Map([['apc', output]]) })),
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    __resetApc40XyCrosshairForTests();
  });

  it('paints a row, column, and highlighted intersection', async () => {
    paintApc40Crosshair({ x: 0, y: 0, source: 'supercontrol' });
    await vi.runOnlyPendingTimersAsync();

    const messages = output.send.mock.calls.map(([message]) => message as number[]);
    expect(messages).toContainEqual([0x90, 0x35, 3]);
    expect(messages).toContainEqual([0x91, 0x35, 5]);
    expect(messages).toContainEqual([0x90, 0x36, 5]);
  });

  it('does not paint when disabled', async () => {
    setApc40XyCrosshairEnabled(false);
    paintApc40Crosshair({ x: 0.5, y: 0.5, source: 'test' });
    await vi.runOnlyPendingTimersAsync();

    expect(output.send).not.toHaveBeenCalled();
  });
});