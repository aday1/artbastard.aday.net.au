import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import StageMapFixtureSetup from './StageMapFixtureSetup';
import { useStore } from '../../store';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

const fixture = {
  id: 'fixture-wash-1',
  name: 'Wash 1',
  type: 'RGB Wash',
  startAddress: 1,
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
    { name: 'Green', type: 'green' },
    { name: 'Blue', type: 'blue' },
  ],
};

describe('StageMapFixtureSetup', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    (HTMLElement.prototype as any).setPointerCapture = vi.fn();
    (HTMLElement.prototype as any).releasePointerCapture = vi.fn();
    useStore.setState({
      fixtures: [fixture],
      fixtureLayout: [
        {
          id: 'layout-wash-1',
          fixtureId: fixture.id,
          fixtureStoreId: fixture.id,
          name: fixture.name,
          type: fixture.type,
          x: 120,
          y: 180,
          rotation: 0,
          scale: 1,
          dmxAddress: 1,
          startAddress: 1,
        },
      ],
      groups: [],
      selectedFixtures: [],
      scenes: [],
    } as any);
  });

  it('renders fixture setup as a canvas-first stage map', () => {
    render(<StageMapFixtureSetup />);

    const stageCanvas = screen.getByRole('application', { name: /canvas-first fixture stage map/i });
    expect(stageCanvas).toBeDefined();
    expect(screen.getByText('Top-down Stage Map')).toBeDefined();
    expect(screen.getByText('Fixture Library')).toBeDefined();
    expect(screen.getByText('Inspector')).toBeDefined();
    expect(within(stageCanvas).getByText('Wash 1')).toBeDefined();
  });

  it('selects a fixture node into the shared selectedFixtures state', () => {
    render(<StageMapFixtureSetup />);

    const stageCanvas = screen.getByRole('application', { name: /canvas-first fixture stage map/i });
    fireEvent.pointerDown(within(stageCanvas).getByTitle(/Wash 1.*DMX 1-4/), {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    expect(useStore.getState().selectedFixtures).toEqual(['fixture-wash-1']);
  });
});
