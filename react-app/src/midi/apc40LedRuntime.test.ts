import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetApc40LedRuntimeForTests,
  getApc40Outputs,
  notifyApc40LedDirty,
  sendApc40NoteOn,
  subscribeApc40LedDirty,
} from './apc40LedRuntime';

describe('apc40LedRuntime', () => {
  beforeEach(() => {
    __resetApc40LedRuntimeForTests();
  });

  it('filters WebMIDI outputs to APC40-looking ports', async () => {
    const apc = { name: 'Akai APC40 Output', manufacturer: 'Akai', send: vi.fn() };
    const other = { name: 'Other MIDI', manufacturer: 'Other', send: vi.fn() };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn(() => Promise.resolve({ outputs: new Map([['apc', apc], ['other', other]]) })),
    });

    await expect(getApc40Outputs()).resolves.toEqual([apc]);
  });

  it('sends note-on bytes through the selected channel', () => {
    const output = { name: 'Akai APC40 Output', manufacturer: 'Akai', send: vi.fn() } as unknown as WebMidi.MIDIOutput;

    expect(sendApc40NoteOn(output, 2, 0x35, 6)).toBe(true);
    expect(output.send).toHaveBeenCalledWith([0x92, 0x35, 6]);
  });

  it('notifies and unsubscribes dirty listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeApc40LedDirty(listener);

    notifyApc40LedDirty('flourish-complete');
    unsubscribe();
    notifyApc40LedDirty('manual');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('flourish-complete');
  });
});