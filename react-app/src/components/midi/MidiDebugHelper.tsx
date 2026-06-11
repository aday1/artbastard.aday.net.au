import React, { useEffect } from 'react';
import { useStore } from '../../store';

/**
 * This component helps debug MIDI message processing
 * It doesn't render anything but provides a way to test MIDI to DMX flow
 */
export const MidiDebugHelper: React.FC = () => {
  const midiMappings = useStore(state => state.midiMappings);
  const addMidiMessage = useStore(state => state.addMidiMessage);

  useEffect(() => {
    // Add a key handler to simulate MIDI messages for testing
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only respond to specific key combinations
      if (event.ctrlKey && event.key === 'm') {
        console.log('[MidiDebugHelper] MIDI mappings:', midiMappings);
        
        // Create a test message for each mapping
        Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
          if (!mapping) return;
          
          const testValue = Math.floor(Math.random() * 127); // Random value between 0-127
          
          if (mapping.controller !== undefined) {
            // Simulate a CC message
            const testCCMessage = {
              type: 'cc',
              _type: 'cc',
              channel: mapping.channel,
              controller: mapping.controller,
              value: testValue,
              source: 'Debug Simulator'
            };
            
            console.log(`[MidiDebugHelper] Simulating CC message for DMX channel ${dmxChannelStr}:`, testCCMessage);
            addMidiMessage(testCCMessage);
          } else if (mapping.note !== undefined) {
            // Simulate a Note On message
            const testNoteMessage = {
              type: 'noteon',
              _type: 'noteon',
              channel: mapping.channel,
              note: mapping.note,
              velocity: testValue,
              source: 'Debug Simulator'
            };
            
            console.log(`[MidiDebugHelper] Simulating Note message for DMX channel ${dmxChannelStr}:`, testNoteMessage);
            addMidiMessage(testNoteMessage);
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [midiMappings, addMidiMessage]);

  // This component doesn't render anything
  return null;
};

export default MidiDebugHelper;
