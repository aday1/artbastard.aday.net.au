import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApc40Health } from './useApc40Health';
import { initApc40 } from '../midi/apc40Init';
import { resetPortHealth } from '../midi/midiOutputGuard';
import { notifyApc40LedDirty } from '../midi/apc40LedRuntime';

const notification = vi.fn();
vi.mock('../store', () => ({ useStore: (selector: any) => selector({ addNotification: notification }) }));
vi.mock('../midi/apc40Init', () => ({
  initApc40: vi.fn(() => ({ inquirySent: true, modeSent: true })),
  isApc40Port: (port: any) => port.name === 'Akai APC40',
  parseDeviceInquiryReply: () => null,
  isApc40InquiryReply: () => false,
}));
vi.mock('../midi/midiOutputGuard', () => ({ resetPortHealth: vi.fn() }));
vi.mock('../midi/apc40LedRuntime', () => ({ notifyApc40LedDirty: vi.fn() }));

describe('APC40 Web MIDI initialization lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initApc40).mockReturnValue({ inquirySent: true, modeSent: true });
  });

  function surface() {
    const access = Object.assign(new EventTarget(), {
      inputs: new Map(), outputs: new Map(),
    });
    const output = { id: 'apc40-output', name: 'Akai APC40', state: 'connected' };
    access.outputs.set(output.id, output);
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    const refresh = () => act(() => { access.dispatchEvent(new Event('statechange')); });
    return { access, output, refresh };
  }

  it('initializes once, then reinitializes a same-object reconnect and same-name replacement', async () => {
    const { access, output, refresh } = surface();
    const hook = renderHook(() => useApc40Health());
    await waitFor(() => expect(initApc40).toHaveBeenCalledTimes(1));
    refresh();
    expect(initApc40).toHaveBeenCalledTimes(1);
    output.state = 'disconnected';
    refresh();
    expect(resetPortHealth).toHaveBeenCalledWith(output);
    output.state = 'connected';
    refresh();
    expect(initApc40).toHaveBeenCalledTimes(2);
    const replacement = { ...output };
    access.outputs.set(output.id, replacement);
    refresh();
    expect(initApc40).toHaveBeenLastCalledWith(replacement);
    expect(initApc40).toHaveBeenCalledTimes(3);
    expect(notifyApc40LedDirty).toHaveBeenCalledTimes(3);
    hook.unmount();
    refresh();
    expect(initApc40).toHaveBeenCalledTimes(3);
  });

  it('does not cache a failed mode send and clears even a never-initialized port health after disconnect', async () => {
    const { output, refresh } = surface();
    vi.mocked(initApc40).mockReturnValue({ inquirySent: true, modeSent: false });
    renderHook(() => useApc40Health());
    await waitFor(() => expect(initApc40).toHaveBeenCalledTimes(1));
    refresh();
    expect(initApc40).toHaveBeenCalledTimes(2);
    expect(notifyApc40LedDirty).not.toHaveBeenCalled();
    output.state = 'disconnected';
    refresh();
    expect(resetPortHealth).toHaveBeenCalledWith(output);
    output.state = 'connected';
    vi.mocked(initApc40).mockReturnValue({ inquirySent: true, modeSent: true });
    refresh();
    expect(initApc40).toHaveBeenCalledTimes(3);
    expect(notifyApc40LedDirty).toHaveBeenCalledTimes(1);
  });
});
