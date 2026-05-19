import { describe, expect, it, vi } from 'vitest';
import { handleActTriggerAction, ActTriggerStore } from './actTriggerHandler';

const buildStore = (playback: { isPlaying: boolean; currentActId?: string | null }): ActTriggerStore => ({
  actPlaybackState: playback,
  playAct: vi.fn(),
  pauseAct: vi.fn(),
  stopAct: vi.fn(),
  nextActStep: vi.fn(),
  previousActStep: vi.fn(),
});

describe('actTriggerHandler', () => {
  it('runs next action and ensures act playback is started when needed', () => {
    const store = buildStore({ isPlaying: false, currentActId: 'act-a' });
    const handled = handleActTriggerAction(store, 'act-b', 'next');

    expect(handled).toBe(true);
    expect(store.playAct).toHaveBeenCalledWith('act-b');
    expect(store.nextActStep).toHaveBeenCalledOnce();
  });

  it('runs previous action without replay when act is already active', () => {
    const store = buildStore({ isPlaying: true, currentActId: 'act-b' });
    const handled = handleActTriggerAction(store, 'act-b', 'previous');

    expect(handled).toBe(true);
    expect(store.playAct).not.toHaveBeenCalled();
    expect(store.previousActStep).toHaveBeenCalledOnce();
  });

  it('toggles active act by pausing when currently playing same act', () => {
    const store = buildStore({ isPlaying: true, currentActId: 'act-c' });
    const handled = handleActTriggerAction(store, 'act-c', 'toggle');

    expect(handled).toBe(true);
    expect(store.pauseAct).toHaveBeenCalledOnce();
    expect(store.playAct).not.toHaveBeenCalled();
  });

  it('returns false for unknown actions', () => {
    const store = buildStore({ isPlaying: false, currentActId: null });
    const handled = handleActTriggerAction(store, 'act-z', 'unknown-action');

    expect(handled).toBe(false);
    expect(store.playAct).not.toHaveBeenCalled();
    expect(store.pauseAct).not.toHaveBeenCalled();
    expect(store.stopAct).not.toHaveBeenCalled();
  });
});
