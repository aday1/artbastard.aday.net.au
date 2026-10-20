import { describe, expect, it, vi } from 'vitest';
import { initApc40 } from './apc40Init';

vi.mock('./midiOutputGuard', () => ({
  safeMidiSend: (output: any, bytes: number[]) => {
    try { output.send(bytes); return true; } catch { return false; }
  },
}));

describe('APC40 introduction', () => {
  it('sends channel-zero inquiry then the documented unbanked Mode2 introduction', () => {
    const send = vi.fn();
    expect(initApc40({ send } as any)).toEqual({ inquirySent: true, modeSent: true });
    expect(send.mock.calls).toEqual([
      [[0xf0, 0x7e, 0, 6, 1, 0xf7]],
      [[0xf0, 0x47, 0x7f, 0x73, 0x60, 0, 4, 0x42, 9, 4, 1, 0xf7]],
    ]);
  });

  it('reports a failed mode send even if inquiry succeeded', () => {
    const send = vi.fn().mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw Error('disconnected'); });
    expect(initApc40({ send } as any)).toEqual({ inquirySent: true, modeSent: false });
  });
});
