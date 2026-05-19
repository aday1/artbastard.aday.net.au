import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';

export const useGlobalBrowserMidi = () => {
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
  const [browserMidiEnabled, setBrowserMidiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [activeInputs, setActiveInputs] = useState<Set<string>>(new Set());
  // Store handler references so we can remove them properly
  const handlerRefs = useRef<Map<string, (event: WebMidi.MIDIMessageEvent) => void>>(new Map());

  const { addNotification } = useStore(state => ({
    addNotification: state.addNotification,
  }));

  // Initialize Web MIDI API
  useEffect(() => {
    const initMidi = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const access = await navigator.requestMIDIAccess({ sysex: false });
          setMidiAccess(access);
          setBrowserMidiEnabled(true);
          
          // Update inputs list
          const inputList = Array.from(access.inputs.values());
          setInputs(inputList);
          
          console.log('[GlobalBrowserMidi] Web MIDI initialized successfully');
          
          // Listen for state changes
          access.onstatechange = () => {
            const newInputs = Array.from(access.inputs.values());
            setInputs(newInputs);
            console.log('[GlobalBrowserMidi] MIDI devices changed:', newInputs.map(i => i.name));
          };
          
        } else {
          setError('Web MIDI API not supported in this browser');
          console.warn('[GlobalBrowserMidi] Web MIDI API not supported');
        }
      } catch (err: unknown) {
        console.error('[GlobalBrowserMidi] Failed to initialize Web MIDI:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      }
    };

    initMidi();
  }, []);

  // Connect to a browser MIDI input
  const connectBrowserInput = useCallback((inputId: string) => {
    if (!midiAccess) return;

    const input = midiAccess.inputs.get(inputId);
    if (!input) return;

    // Remove existing listener if one exists (prevent duplicates)
    const existingHandler = handlerRefs.current.get(inputId);
    if (existingHandler) {
      input.removeEventListener('midimessage', existingHandler);
      handlerRefs.current.delete(inputId);
      console.log('[GlobalBrowserMidi] Removed existing listener for:', input.name);
    }

    // Clear onmidimessage property to prevent conflicts with useBrowserMidi hook
    // (useBrowserMidi uses onmidimessage property, we use addEventListener)
    if (input.onmidimessage) {
      console.log('[GlobalBrowserMidi] Clearing onmidimessage property to prevent conflicts');
      input.onmidimessage = null;
    }

    const handleMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
      const [status, data1, data2] = event.data;
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      let messageToStore: any = {
        source: 'browser',
        timestamp: Date.now()
      };

      if (messageType === 0x90 && data2 > 0) { // Note On
        messageToStore = { 
          _type: 'noteon', 
          channel: channel, 
          note: data1, 
          velocity: data2, 
          source: 'browser',
          timestamp: Date.now()
        };
      } else if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) { // Note Off
        messageToStore = { 
          _type: 'noteoff', 
          channel: channel, 
          note: data1, 
          velocity: data2, 
          source: 'browser',
          timestamp: Date.now()
        };
      } else if (messageType === 0xB0) { // Control Change
        messageToStore = { 
          _type: 'cc', 
          channel: channel, 
          controller: data1, 
          value: data2, 
          source: 'browser',
          timestamp: Date.now()
        };
      }

      // Add message to store
      useStore.getState().addMidiMessage(messageToStore);
    };

    // Store the handler reference
    handlerRefs.current.set(inputId, handleMidiMessage);
    input.addEventListener('midimessage', handleMidiMessage);
    setActiveInputs(prev => new Set([...prev, inputId]));

    console.log('[GlobalBrowserMidi] Connected to input:', input.name);
    
    addNotification({
      message: `Connected to browser MIDI: ${input.name}`,
      type: 'success',
      priority: 'normal'
    });
  }, [midiAccess, addNotification]);

  // Disconnect from a browser MIDI input
  const disconnectBrowserInput = useCallback((inputId: string) => {
    if (!midiAccess) return;

    const input = midiAccess.inputs.get(inputId);
    if (!input) return;

    // Remove the event listener using the stored handler reference
    const handler = handlerRefs.current.get(inputId);
    if (handler) {
      input.removeEventListener('midimessage', handler);
      handlerRefs.current.delete(inputId);
      console.log('[GlobalBrowserMidi] Removed listener for:', input.name);
    }

    // Also clear onmidimessage property if it was set
    if (input.onmidimessage) {
      input.onmidimessage = null;
    }

    setActiveInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(inputId);
      return newSet;
    });

    console.log('[GlobalBrowserMidi] Disconnected from input:', input.name);
    
    addNotification({
      message: `Disconnected from browser MIDI: ${input.name}`,
      type: 'info',
      priority: 'normal'
    });
  }, [midiAccess, addNotification]);

  // Refresh MIDI devices
  const refreshDevices = useCallback(() => {
    if (midiAccess) {
      const inputList = Array.from(midiAccess.inputs.values());
      setInputs(inputList);
      console.log('[GlobalBrowserMidi] Refreshed MIDI devices:', inputList.map(i => i.name));
    }
  }, [midiAccess]);

  // Cleanup: Remove all listeners when component unmounts
  useEffect(() => {
    return () => {
      if (midiAccess) {
        handlerRefs.current.forEach((handler, inputId) => {
          const input = midiAccess.inputs.get(inputId);
          if (input) {
            input.removeEventListener('midimessage', handler);
            // Also clear onmidimessage property
            if (input.onmidimessage) {
              input.onmidimessage = null;
            }
            console.log('[GlobalBrowserMidi] Cleaned up listener for:', inputId);
          }
        });
        handlerRefs.current.clear();
      }
    };
  }, [midiAccess]);

  return {
    isSupported: !!navigator.requestMIDIAccess,
    browserMidiEnabled,
    error,
    browserInputs: inputs,
    activeBrowserInputs: Array.from(activeInputs),
    connectBrowserInput,
    disconnectBrowserInput,
    refreshDevices,
  };
};
