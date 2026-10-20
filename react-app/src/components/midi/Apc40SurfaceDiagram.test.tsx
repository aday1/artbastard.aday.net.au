// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Apc40SurfaceDiagram } from './Apc40SurfaceDiagram';
import { useStore } from '../../store';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

describe('APC40 MK1 diagram fixture selection', () => {
  beforeEach(() => {
    useStore.setState({
      fixtures: [
        { id: 'fixture-a', name: 'Beam A', channels: [] },
        { id: 'fixture-b', name: 'Beam B', channels: [] },
        { id: 'fixture-c', name: 'Beam C', channels: [] },
      ],
      // This deliberately differs from fixture 1: Track Select must not select it.
      groups: [{ id: 'group-a', name: 'Other beams', fixtureIndices: [1, 2] }],
      selectedFixtures: ['fixture-c'],
      scenes: [],
      acts: [],
      midiMessages: [],
      superControlMidiMappings: [],
    } as any);
  });

  afterEach(cleanup);

  it('toggles the same fixture from either row and preserves other selections', () => {
    render(<Apc40SurfaceDiagram mode="fixtures" />);
    const track = () => screen.getByTitle(/^Track Select 1: /);
    const solo = () => screen.getByTitle(/^Solo\/Cue 1: /);

    expect(track().getAttribute('aria-pressed')).toBe('false');
    expect(solo().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(track());
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-c', 'fixture-a']);
    expect(track().getAttribute('aria-pressed')).toBe('true');
    expect(solo().getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(solo());
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-c']);
    expect(track().getAttribute('aria-pressed')).toBe('false');
    expect(solo().getAttribute('aria-pressed')).toBe('false');
  });

  it('leaves unpatched positions disabled and unlit on both rows', () => {
    render(<Apc40SurfaceDiagram mode="fixtures" />);
    for (const title of [/^Track Select 4: /, /^Solo\/Cue 4: /]) {
      const button = screen.getByTitle(title) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(button);
    }
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-c']);
  });
});
