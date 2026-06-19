import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtbastardXYPad } from './ArtbastardXYPad';

describe('ArtbastardXYPad', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => null),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not re-save inserted shapes when parent callback identity changes', async () => {
    const onSaved = vi.fn();

    const Harness = () => {
      const [, setSaveCount] = useState(0);
      return (
        <ArtbastardXYPad
          pan={128}
          tilt={128}
          onPanTiltChange={() => {}}
          onPathSaved={(points) => {
            onSaved(points);
            setSaveCount((count) => count + 1);
          }}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /insert shape path/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
