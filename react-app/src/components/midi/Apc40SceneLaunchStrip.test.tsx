// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Apc40SceneLaunchStrip } from './Apc40SceneLaunchStrip';
import { useStore } from '../../store';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

const makeAct = (id: string, name: string) => ({
  id,
  name,
  description: '',
  steps: [{ id: `${id}-step`, sceneName: 'Warm Scene', duration: 1000 }],
  triggers: [],
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('Apc40SceneLaunchStrip', () => {
  beforeEach(() => {
    useStore.setState({ acts: [], actPlaybackState: { currentActId: null } } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no APC40 launch acts exist', () => {
    render(<Apc40SceneLaunchStrip />);

    expect(screen.queryByLabelText('APC40 SCENE LAUNCH bindings')).toBeNull();
  });

  it('renders only populated launch acts and no empty cells', () => {
    useStore.setState({
      acts: [makeAct('act-1', 'Warmup'), makeAct('act-2', 'Peak')],
      actPlaybackState: { currentActId: 'act-2' },
    } as any);

    render(<Apc40SceneLaunchStrip />);

    expect(screen.getByText('Warmup')).toBeDefined();
    expect(screen.getByText('Peak')).toBeDefined();
    expect(screen.queryByText('empty')).toBeNull();
    expect(screen.getByTitle(/SCENE LAUNCH 2.*Peak/).getAttribute('aria-pressed')).toBe('true');
  });

  it('starts the clicked ACT from the launch strip', () => {
    useStore.setState({
      scenes: [{ name: 'Warm Scene', channelValues: new Array(512).fill(0) }],
      acts: [makeAct('act-1', 'Warmup')],
      actPlaybackState: { currentActId: null, isPlaying: false },
    } as any);

    render(<Apc40SceneLaunchStrip />);
    fireEvent.click(screen.getByTitle(/SCENE LAUNCH 1.*Warmup/));

    expect(useStore.getState().actPlaybackState.currentActId).toBe('act-1');
    expect(useStore.getState().actPlaybackState.isPlaying).toBe(true);
  });
});
