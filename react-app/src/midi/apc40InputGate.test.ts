import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApc40InputGate } from './apc40InputGate';

const cc = (controller: number, value = 0, extra = {}) => ({
  _type: 'cc', source: 'Akai APC40', channel: 0, controller, value, ...extra,
});

describe('APC40 bank snapshot gate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drops the complete recorded 4ms frame without delivering its prefix', () => {
    const deliver = vi.fn();
    const gate = createApc40InputGate(deliver);
    [0, 0, 1, 0, 0, 7, 0, 0].forEach((value, index) => {
      gate.push(cc(16 + index, value));
      vi.advanceTimersByTime(0.5);
      expect(deliver).not.toHaveBeenCalled();
    });
    vi.advanceTimersByTime(30);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('delivers a single knob after 20ms and preserves an interrupted prefix before an immediate fader', () => {
    const deliver = vi.fn();
    const gate = createApc40InputGate(deliver);
    gate.push(cc(16, 31));
    vi.advanceTimersByTime(20);
    expect(deliver.mock.calls.map(([message]) => message)).toEqual([cc(16, 31)]);
    deliver.mockClear();
    const messages = [cc(16, 7), cc(17, 9), cc(7, 12)];
    messages.forEach(gate.push);
    expect(deliver.mock.calls.map(([message]) => message)).toEqual(messages);
    vi.advanceTimersByTime(30);
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['out of order', [cc(16), cc(18), cc(17)]],
    ['different source', [cc(16), cc(17, 0, { source: 'Other APC40' }), cc(18)]],
    ['different channel', [cc(16), cc(17, 0, { channel: 1 }), cc(18)]],
  ])('preserves %s messages', (_label, messages) => {
    const deliver = vi.fn();
    const gate = createApc40InputGate(deliver);
    messages.forEach(gate.push);
    vi.advanceTimersByTime(30);
    expect(deliver.mock.calls.map(([message]) => message)).toEqual(messages);
  });

  it('preserves a slow ascending knob sequence and does not filter MK2', () => {
    for (const source of ['Akai APC40', 'Akai APC40 MK2']) {
      const deliver = vi.fn();
      const gate = createApc40InputGate(deliver);
      const messages = Array.from({ length: 8 }, (_, index) => cc(16 + index, index, { source }));
      messages.forEach((message) => {
        gate.push(message);
        if (source === 'Akai APC40') vi.advanceTimersByTime(21);
      });
      expect(deliver.mock.calls.map(([message]) => message)).toEqual(messages);
    }
  });

  it('cancels a pending prefix when its owner unmounts', () => {
    const deliver = vi.fn();
    const gate = createApc40InputGate(deliver);
    gate.push(cc(16, 90));
    gate.dispose();
    vi.advanceTimersByTime(30);
    expect(deliver).not.toHaveBeenCalled();
  });
});
