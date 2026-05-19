import { useStore } from '../store';
import { useEffect } from 'react';

export const useActsMidiProcessor = () => {
  const { actTriggers, processActTrigger } = useStore();

  useEffect(() => {
    // Listen for MIDI messages that match ACT triggers
    const handleMidiMessage = (message: any) => {
      if (!message.note || !message.channel) return;

      // Find matching MIDI triggers
      const matchingTriggers = actTriggers.filter(trigger => 
        trigger.type === 'midi' && 
        trigger.enabled && 
        trigger.midiNote === message.note &&
        trigger.midiChannel === message.channel
      );

      // Process each matching trigger
      matchingTriggers.forEach(trigger => {
        // Only trigger on note on (velocity > 0)
        if (message.velocity && message.velocity > 0) {
          processActTrigger(trigger);
        }
      });
    };

    // Register MIDI message handler
    window.addEventListener('midiMessage', handleMidiMessage as EventListener);

    return () => {
      window.removeEventListener('midiMessage', handleMidiMessage as EventListener);
    };
  }, [actTriggers, processActTrigger]);
};
