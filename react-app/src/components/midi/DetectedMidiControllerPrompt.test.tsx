import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetectedMidiControllerPrompt } from './DetectedMidiControllerPrompt';
import {
  MIDI_CONNECT_BROWSER_EVENT,
  MIDI_CONNECT_ROLI_EVENT,
  MIDI_CONTROLLER_DETECTED_EVENT,
  ROLI_LIGHTPAD_CONNECT_APPROVED_KEY,
  type DetectedMidiController,
} from '../../midi/detectedMidiController';

describe('DetectedMidiControllerPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('prompts for a detected APC40 and dispatches a browser connect request', () => {
    const connectSpy = vi.fn();
    window.addEventListener(MIDI_CONNECT_BROWSER_EVENT, connectSpy);
    render(<DetectedMidiControllerPrompt />);

    const controller: DetectedMidiController = {
      id: 'apc-input',
      name: 'Akai APC40',
      kind: 'apc40',
      transport: 'browser',
      templateId: 'apc40_mk1',
    };

    act(() => {
      window.dispatchEvent(new CustomEvent<DetectedMidiController>(MIDI_CONTROLLER_DETECTED_EVENT, { detail: controller }));
    });

    expect(screen.getByText('Akai APC40 detected')).toBeDefined();
    fireEvent.click(screen.getByText('Connect APC40'));
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect((connectSpy.mock.calls[0][0] as CustomEvent<DetectedMidiController>).detail).toEqual(controller);
    window.removeEventListener(MIDI_CONNECT_BROWSER_EVENT, connectSpy);
  });

  it('approves ROLI connection and dispatches the ROLI connect request', () => {
    const connectSpy = vi.fn();
    window.addEventListener(MIDI_CONNECT_ROLI_EVENT, connectSpy);
    render(<DetectedMidiControllerPrompt />);

    const controller: DetectedMidiController = {
      id: 'roli-input',
      name: 'ROLI Lightpad BLOCK',
      kind: 'roli-lightpad',
      transport: 'browser',
      templateId: null,
    };

    act(() => {
      window.dispatchEvent(new CustomEvent<DetectedMidiController>(MIDI_CONTROLLER_DETECTED_EVENT, { detail: controller }));
    });

    fireEvent.click(screen.getByText('Connect ROLI'));
    expect(localStorage.getItem(ROLI_LIGHTPAD_CONNECT_APPROVED_KEY)).toBe('true');
    expect(connectSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener(MIDI_CONNECT_ROLI_EVENT, connectSpy);
  });
});
