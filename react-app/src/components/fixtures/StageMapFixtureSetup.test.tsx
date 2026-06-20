import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import StageMapFixtureSetup from './StageMapFixtureSetup';
import { useStore } from '../../store';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

vi.mock('./UnifiedStageWorkbench', () => ({
  UnifiedStageWorkbench: ({
    mode,
    onModeChange,
  }: {
    mode?: string;
    onModeChange?: (mode: string) => void;
  }) => (
    <div aria-label="Unified stage workbench mock">
      <button type="button" role="tab" onClick={() => onModeChange?.('apc')}>
        APC40
      </button>
      {mode === 'apc' ? <div>Stage view</div> : null}
    </div>
  ),
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
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    expect(useStore.getState().selectedFixtures).toEqual(['fixture-wash-1']);
  });

  it('releases fixture pointer capture when dragging completes', async () => {
    render(<StageMapFixtureSetup />);

    const stageCanvas = screen.getByRole('application', { name: /canvas-first fixture stage map/i });
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(pointerDown, {
      button: { value: 0 },
      pointerId: { value: 7 },
      clientX: { value: 100 },
      clientY: { value: 100 },
    });
    fireEvent(within(stageCanvas).getByTitle(/Wash 1.*DMX 1-4/), pointerDown);
    await waitFor(() => expect(useStore.getState().selectedFixtures).toEqual(['fixture-wash-1']));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    await waitFor(() => expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalledWith(7));
  });

  it('hides fixture side panes in APC40 map-only drive mode', () => {
    render(<StageMapFixtureSetup />);

    fireEvent.click(screen.getByRole('tab', { name: /APC40/i }));

    expect(screen.getByRole('application', { name: /canvas-first fixture stage map/i })).toBeDefined();
    expect(screen.queryByText('Fixture Library')).toBeNull();
    expect(screen.queryByText('Inspector')).toBeNull();
  });

  it('collapses APC and stage map panes and restores them on reset layout', () => {
    const { container } = render(<StageMapFixtureSetup />);
    fireEvent.click(screen.getByRole('tab', { name: /APC40/i }));

    expect(screen.getByText('Stage view')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Hide APC/i }));
    expect(container.querySelector('[class*="drawerStackCollapsed"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Show APC panel/i }));
    expect(container.querySelector('[class*="drawerStackCollapsed"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Hide map/i }));
    expect(container.querySelector('[class*="workspaceCollapsed"]')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new Event('resetLayout'));
    });
    expect(container.querySelector('[class*="workspaceCollapsed"]')).toBeNull();
    expect(container.querySelector('[class*="drawerStackCollapsed"]')).toBeNull();
    expect(screen.getByRole('application', { name: /canvas-first fixture stage map/i })).toBeDefined();
    expect(screen.getByText('Stage view')).toBeDefined();
  });

  it('does not start fixture dragging from a right-click', () => {
    render(<StageMapFixtureSetup />);

    const stageCanvas = screen.getByRole('application', { name: /canvas-first fixture stage map/i });
    const node = within(stageCanvas).getByTitle(/Wash 1.*DMX 1-4/);
    const event = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      button: { value: 2 },
      pointerId: { value: 2 },
      clientX: { value: 100 },
      clientY: { value: 100 },
    });
    fireEvent(node, event);

    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();
    expect(useStore.getState().selectedFixtures).toEqual([]);
  });

  it('keeps large fixture channel lists compact until expanded', () => {
    const largeFixture = {
      ...fixture,
      channels: Array.from({ length: 10 }, (_, index) => ({
        name: `Channel ${index + 1}`,
        type: 'other',
      })),
    };
    useStore.setState({
      fixtures: [largeFixture],
      selectedFixtures: [largeFixture.id],
    } as any);

    render(<StageMapFixtureSetup />);

    expect(screen.getByText(/10 ch .*DMX 1-10/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'All 10' })).toBeDefined();
    expect(screen.queryByDisplayValue('Default')).toBeNull();
    expect(screen.queryByText('Channel 9')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All 10' }));

    expect(screen.getByText('Channel 10')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Less' })).toBeDefined();
  });
});
