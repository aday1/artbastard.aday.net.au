import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Apc40SceneLaunchStrip } from './Apc40SceneLaunchStrip';
import { useStore } from '../../store';

const makeAct = (id: string, name: string) => ({
  id,
  name,
  description: '',
  steps: [],
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
});
