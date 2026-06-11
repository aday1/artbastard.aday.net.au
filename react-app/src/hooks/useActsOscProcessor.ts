import { useStore } from '../store';
import { useEffect } from 'react';

export const useActsOscProcessor = () => {
  const { actTriggers, processActTrigger } = useStore();

  useEffect(() => {
    // Listen for OSC messages that match ACT triggers
    const handleOscMessage = (message: any) => {
      if (!message.address || !message.args) return;

      // Find matching OSC triggers
      const matchingTriggers = actTriggers.filter(trigger => 
        trigger.type === 'osc' && 
        trigger.enabled && 
        trigger.address === message.address
      );

      // Process each matching trigger
      matchingTriggers.forEach(trigger => {
        // Check if the OSC message has a value (for button presses, etc.)
        const value = message.args[0]?.value || message.args[0];
        
        // Only trigger on non-zero values (button press, not release)
        if (value && value > 0) {
          processActTrigger(trigger);
        }
      });
    };

    // Register OSC message handler
    window.addEventListener('oscMessage', handleOscMessage as EventListener);

    return () => {
      window.removeEventListener('oscMessage', handleOscMessage as EventListener);
    };
  }, [actTriggers, processActTrigger]);
};
