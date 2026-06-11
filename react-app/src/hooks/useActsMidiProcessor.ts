import { useStore } from '../store';
import { useEffect } from 'react';

export const useActsMidiProcessor = () => {
  const { actTriggers, processActTrigger } = useStore();

  useEffect(() => {
    // Listen for MIDI messages that match ACT triggers
    const handleMidiMessage = (event: Event) => {
      const message = event instanceof CustomEvent ? event.detail : event;
      if (message.note === undefined || message.channel === undefined) return;

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
