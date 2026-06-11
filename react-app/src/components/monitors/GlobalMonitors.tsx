import React from 'react';
import { MidiMonitor } from '../midi/MidiMonitor';
import { OscMonitor } from '../osc/OscMonitor';
import { DmxMonitor } from '../dmx/DmxMonitor';

/**
 * Global floating MIDI/OSC monitors. They are intentionally mounted at the app
 * shell level so operator activity is visible regardless of the current page.
 */
export const GlobalMonitors: React.FC = () => {
  return (
    <>
      <MidiMonitor />
      <OscMonitor />
      <DmxMonitor />
    </>
  );
};
