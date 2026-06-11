import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { StageMapDashboard } from './StageMapDashboard';
import { useStore } from '../../store';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

const fixtureA = {
  id: 'fixture-a',
  name: 'Wash A',
  type: 'RGB Wash',
  startAddress: 1,
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
    { name: 'Green', type: 'green' },
    { name: 'Blue', type: 'blue' },
  ],
};

const fixtureB = {
  id: 'fixture-b',
  name: 'Wash B',
  type: 'RGB Wash',
  startAddress: 5,
  channels: [
    { name: 'Dimmer', type: 'dimmer' },
    { name: 'Red', type: 'red' },
    { name: 'Green', type: 'green' },
    { name: 'Blue', type: 'blue' },
  ],
};

const layoutFor = (id: string, name: string, type: string, addr: number, x: number, y: number) => ({
  id: `layout-${id}`,
  fixtureId: id,
  fixtureStoreId: id,
  name,
  type,
  x,
  y,
  rotation: 0,
  scale: 1,
  dmxAddress: addr,
  startAddress: addr,
});

describe('StageMapDashboard', () => {
  beforeEach(() => {
    useStore.setState({
      fixtures: [fixtureA, fixtureB],
      fixtureLayout: [
        layoutFor('fixture-a', 'Wash A', 'RGB Wash', 1, 120, 180),
        layoutFor('fixture-b', 'Wash B', 'RGB Wash', 5, 320, 180),
      ],
      groups: [],
      selectedFixtures: [],
      dmxChannels: new Array(512).fill(0),
    } as any);
  });

  it('shift-click adds a fixture to selectedFixtures', () => {
    const { getByTitle } = render(<StageMapDashboard showGroupPicker={false} />);

    fireEvent.click(getByTitle(/^Wash A · DMX 1/));
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-a']);

    fireEvent.click(getByTitle(/^Wash B · DMX 5/), { shiftKey: true });
    expect(useStore.getState().selectedFixtures).toEqual(['fixture-a', 'fixture-b']);
  });

  it('illuminates a fixture node when its DMX channel is non-zero', () => {
    const channels = new Array(512).fill(0);
    channels[0] = 200; // fixture A, dimmer channel
    useStore.setState({ dmxChannels: channels } as any);

    const { getByTitle } = render(<StageMapDashboard showGroupPicker={false} />);

    const nodeA = getByTitle(/^Wash A · DMX 1 · LIVE/);
    expect(nodeA.className).toMatch(/lit/);

    const nodeB = getByTitle(/^Wash B · DMX 5$/);
    expect(nodeB.className).not.toMatch(/lit/);
  });


  it('marks APC-targeted fixtures separately from normal selection', () => {
    const { getByTitle, getByText } = render(
      <StageMapDashboard
        showGroupPicker={false}
        highlightFixtureIds={['fixture-b']}
        highlightLabel="Track 2: Wash B"
      />
    );

    expect(getByText('APC target: Track 2: Wash B')).toBeDefined();
    expect(getByTitle(/^Wash B · DMX 5/).className).toMatch(/apcHighlight/);
  });
  it('honours dmxOverride for static scene previews instead of live channels', () => {
    // Live channels are all zero — overrideprovides the scene snapshot.
    const override = new Array(512).fill(0);
    override[0] = 180;

    const { getByTitle } = render(
      <StageMapDashboard showGroupPicker={false} dmxOverride={override} />
    );

    const nodeA = getByTitle(/^Wash A · DMX 1 · LIVE/);
    expect(nodeA.className).toMatch(/lit/);
  });
});

