import React from 'react';
import { MidiMonitor } from '../midi/MidiMonitor';
import { OscMonitor } from '../osc/OscMonitor';
import { useRouter } from '../../context/RouterContext';

/**
 * GlobalMonitors component renders floating MIDI and OSC monitors on all pages.
 * These monitors are controlled by the debugTools settings in the store.
 * They appear as floating windows that can be collapsed/expanded and positioned.
 */
export const GlobalMonitors: React.FC = () => {
  const { currentView } = useRouter();

  if (currentView === 'fixture') {
    return null;
  }

  return (
    <>
      {/* Floating MIDI Monitor - positioned on the left */}
      <MidiMonitor />
      
      {/* Floating OSC Monitor - positioned on the right */}
      <OscMonitor />
    </>
  );
};
