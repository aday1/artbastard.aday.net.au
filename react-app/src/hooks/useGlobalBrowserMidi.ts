import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { detectTemplateForMidiInterface, getTemplateById } from '../components/midi/midiControllerTemplates';
import { debugLog } from '../utils/debugLog';
import { recordBrowserMidiMessage } from '../midi/midiTransportDedupe';
import {
  DetectedMidiController,
  MIDI_CONNECT_BROWSER_EVENT,
  describeDetectedMidiController,
  dispatchConnectedMidiController,
  dispatchDetectedMidiController,
} from '../midi/detectedMidiController';

export const useGlobalBrowserMidi = () => {
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
  const [browserMidiEnabled, setBrowserMidiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<WebMidi.MIDIInput[]>([]);
  
  // Load saved active inputs from localStorage on initialization
  const loadSavedActiveInputs = (): Set<string> => {
    try {
      const saved = localStorage.getItem('activeBrowserMidiInputs');
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('[GlobalBrowserMidi] Failed to load saved MIDI inputs:', e);
    }
    return new Set();
  };
  
  const [activeInputs, setActiveInputs] = useState<Set<string>>(loadSavedActiveInputs());
  
  // Save active inputs to localStorage whenever they change
  const saveActiveInputs = (inputs: Set<string>) => {
    try {
      localStorage.setItem('activeBrowserMidiInputs', JSON.stringify(Array.from(inputs)));
    } catch (e) {
      console.error('[GlobalBrowserMidi] Failed to save MIDI inputs:', e);
    }
  };
  
  // Store handler references so we can remove them properly
  const handlerRefs = useRef<Map<string, (event: WebMidi.MIDIMessageEvent) => void>>(new Map());
  const templateApplyInFlightRef = useRef<Set<string>>(new Set());
  
  // Throttling for MIDI messages to reduce lag
  const lastMessageTimeRef = useRef<Map<string, number>>(new Map());
  const pendingMessageRef = useRef<Map<string, any>>(new Map());
  const throttleTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const MIDI_THROTTLE_MS = 16; // ~60fps for store updates (monitoring only)
  const MAX_MESSAGE_AGE_MS = 50; // Don't process messages older than 50ms

  const { addNotification, applyMidiControllerTemplate } = useStore(state => ({
    addNotification: state.addNotification,
    applyMidiControllerTemplate: state.applyMidiControllerTemplate,
  }));

  const maybeAutoApplyTemplate = useCallback(
    async (deviceName: string) => {
      const templateId = detectTemplateForMidiInterface(deviceName);
      if (!templateId) return;

      const state = useStore.getState();
      const template = getTemplateById(templateId);
      const expectedSuperControlMappings = template?.superControlMappings ?? [];
      const hasExistingTemplate = expectedSuperControlMappings.length > 0
        ? expectedSuperControlMappings.every((expected) =>
          state.superControlMidiMappings.some((actual) =>
            actual.controlName === expected.controlName &&
            actual.channel === expected.channel &&
            actual.controller === expected.controller &&
            actual.note === expected.note &&
            actual.slotIndex === expected.slotIndex,
          ),
        )
        : Object.keys(state.midiMappings).length > 0;
      if (hasExistingTemplate) return;

      const key = `${templateId}:${deviceName}`;
      if (templateApplyInFlightRef.current.has(key)) return;
      templateApplyInFlightRef.current.add(key);
      try {
        await applyMidiControllerTemplate(templateId, deviceName);
      } finally {
        templateApplyInFlightRef.current.delete(key);
      }
    },
    [applyMidiControllerTemplate],
  );

  // Initialize Web MIDI API
  useEffect(() => {
    let cancelled = false;
    let stateChangeCleanup: (() => void) | null = null;
    const initMidi = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const access = await navigator.requestMIDIAccess({ sysex: false });
          if (cancelled) return;
          setMidiAccess(access);
          setBrowserMidiEnabled(true);
          
          // Update inputs list
          const inputList = Array.from(access.inputs.values());
          setInputs(inputList);
          
          debugLog.log('[GlobalBrowserMidi] Web MIDI initialized successfully');
          
          // Listen for state changes without clobbering other Web MIDI users
          // such as APC40 LED feedback.
          const handleStateChange = () => {
            const newInputs = Array.from(access.inputs.values());
            setInputs(newInputs);
            debugLog.log('[GlobalBrowserMidi] MIDI devices changed:', newInputs.map(i => i.name));
          };
          access.addEventListener('statechange', handleStateChange);
          stateChangeCleanup = () => access.removeEventListener('statechange', handleStateChange);
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
    return () => {
      cancelled = true;
      stateChangeCleanup?.();
    };
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
      debugLog.log('[GlobalBrowserMidi] Removed existing listener for:', input.name);
    }

    // Clear onmidimessage property to prevent conflicts with useBrowserMidi hook
    // (useBrowserMidi uses onmidimessage property, we use addEventListener)
    if (input.onmidimessage) {
      debugLog.log('[GlobalBrowserMidi] Clearing onmidimessage property to prevent conflicts');
      input.onmidimessage = null;
    }

    const handleMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
      const [status, data1, data2] = event.data;
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      const source = input.name || 'Browser MIDI';

      let messageToStore: any = {
        source,
        sourceTransport: 'browser',
        timestamp: Date.now()
      };

      if (messageType === 0x90 && data2 > 0) { // Note On
        messageToStore = { 
          _type: 'noteon', 
          channel: channel, 
          note: data1, 
          velocity: data2, 
          source,
          sourceTransport: 'browser',
          timestamp: Date.now()
        };
      } else if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) { // Note Off
        messageToStore = { 
          _type: 'noteoff', 
          channel: channel, 
          note: data1, 
          velocity: data2, 
          source,
          sourceTransport: 'browser',
          timestamp: Date.now()
        };
      } else if (messageType === 0xB0) { // Control Change
        messageToStore = { 
          _type: 'cc', 
          channel: channel, 
          controller: data1, 
          value: data2, 
          source,
          sourceTransport: 'browser',
          timestamp: Date.now()
        };
      } else if (messageType === 0xE0) { // Pitch Bend
        const rawPitch = ((data2 << 7) | data1);
        messageToStore = {
          _type: 'pitch',
          channel,
          value: rawPitch,
          source,
          sourceTransport: 'browser',
          timestamp: Date.now()
        };
      }

      recordBrowserMidiMessage(messageToStore);

      // Create a unique key for this MIDI control (channel + controller/note)
      const controlKey = messageType === 0xB0 
        ? `cc_${channel}_${data1}` 
        : messageType === 0xE0
        ? `pitch_${channel}`
        : messageType === 0x90 || messageType === 0x80
        ? `note_${channel}_${data1}`
        : `other_${channel}_${data1}`;
      
      const now = Date.now();
      const lastTime = lastMessageTimeRef.current.get(controlKey) || 0;
      const timeSinceLastMessage = now - lastTime;

      // Always store the latest message for this control
      pendingMessageRef.current.set(controlKey, messageToStore);

      // For CC and Pitch messages, process immediately and throttle store updates
      if (messageType === 0xB0 || messageType === 0xE0) {
        const store = useStore.getState();
        
        // Process CC messages directly for immediate DMX updates (bypass store re-render cycle)
        const customEvent = new CustomEvent('midiMessageDirect', {
          detail: messageToStore
        });
        window.dispatchEvent(customEvent);
        
        // Cancel any existing timeout for this control - we only want the latest message
        const existingTimeout = throttleTimeoutRef.current.get(controlKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          throttleTimeoutRef.current.delete(controlKey);
        }
        
        // Throttle store updates to reduce re-renders (only for monitoring)
        if (timeSinceLastMessage >= MIDI_THROTTLE_MS) {
          // Time to update - add to store immediately
          store.addMidiMessage(messageToStore);
          lastMessageTimeRef.current.set(controlKey, now);
          pendingMessageRef.current.delete(controlKey);
        } else {
          // Too soon - schedule a throttled store update (for monitoring only)
          // Store the latest message (overwrites any previous pending)
          pendingMessageRef.current.set(controlKey, messageToStore);
          
          // Schedule timeout to add to store
          const timeout = setTimeout(() => {
            const pending = pendingMessageRef.current.get(controlKey);
            if (pending) {
              // Check message age - don't process if too old (user stopped moving)
              const messageAge = Date.now() - (pending.timestamp || 0);
              if (messageAge < MAX_MESSAGE_AGE_MS) {
                store.addMidiMessage(pending);
                lastMessageTimeRef.current.set(controlKey, Date.now());
              } else {
                // Message too old - user stopped moving, discard it
                debugLog.log(`[GlobalBrowserMidi] Discarding stale message (${messageAge}ms old) for ${controlKey}`);
              }
              pendingMessageRef.current.delete(controlKey);
            }
            throttleTimeoutRef.current.delete(controlKey);
          }, MIDI_THROTTLE_MS - timeSinceLastMessage);
          throttleTimeoutRef.current.set(controlKey, timeout);
        }
      } else {
        // For note on/off, add immediately (less frequent, no throttling needed)
        useStore.getState().addMidiMessage(messageToStore);
        lastMessageTimeRef.current.set(controlKey, now);
      }
    };

    // Store the handler reference
    handlerRefs.current.set(inputId, handleMidiMessage);
    input.addEventListener('midimessage', handleMidiMessage);
    setActiveInputs(prev => {
      if (prev.has(inputId)) return prev;
      const newSet = new Set([...prev, inputId]);
      saveActiveInputs(newSet); // Persist to localStorage
      return newSet;
    });

    debugLog.log('[GlobalBrowserMidi] Connected to input:', input.name);
    
    addNotification({
      message: `Connected to browser MIDI: ${input.name}`,
      type: 'success',
      priority: 'normal'
    });
  }, [midiAccess, addNotification]);

  useEffect(() => {
    if (!midiAccess) return;

    const saved = loadSavedActiveInputs();

    inputs.forEach((input) => {
      if (input.state === 'disconnected') return;

      // Re-attach listener for any input we previously connected (this session
      // or persisted in localStorage) but no longer have a live handler for —
      // happens on every unplug/replug. Without this, the controller goes
      // silent until the user re-clicks Connect.
      const previouslyActive = activeInputs.has(input.id) || saved.has(input.id);
      if (previouslyActive && !handlerRefs.current.has(input.id)) {
        connectBrowserInput(input.id);
      }

      // Also auto-reconnect any input whose name matches a known template
      // (APC40, ROLI, Lightpad, etc.) even on first appearance, restoring the
      // pre-prompt behavior for recognised controllers.
      const templateId = detectTemplateForMidiInterface(input.name || '');
      if (templateId && !activeInputs.has(input.id) && !handlerRefs.current.has(input.id)) {
        void maybeAutoApplyTemplate(input.name || '');
        connectBrowserInput(input.id);
      }

      const controller = describeDetectedMidiController(input.name || '', 'browser', input.id);
      if (!controller) return;
      if (activeInputs.has(input.id) || handlerRefs.current.has(input.id)) {
        dispatchConnectedMidiController(controller);
        return;
      }
      dispatchDetectedMidiController(controller);
    });
  }, [midiAccess, inputs, activeInputs, connectBrowserInput, maybeAutoApplyTemplate]);

  useEffect(() => {
    const handleConnectBrowser = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!midiAccess || !controller || controller.transport !== 'browser') return;
      if (!midiAccess.inputs.has(controller.id)) return;
      if (controller.templateId) void maybeAutoApplyTemplate(controller.name);
      connectBrowserInput(controller.id);
      dispatchConnectedMidiController(controller);
    };

    window.addEventListener(MIDI_CONNECT_BROWSER_EVENT, handleConnectBrowser);
    return () => window.removeEventListener(MIDI_CONNECT_BROWSER_EVENT, handleConnectBrowser);
  }, [midiAccess, connectBrowserInput, maybeAutoApplyTemplate]);
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
      debugLog.log('[GlobalBrowserMidi] Removed listener for:', input.name);
    }

    // Also clear onmidimessage property if it was set
    if (input.onmidimessage) {
      input.onmidimessage = null;
    }

    setActiveInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(inputId);
      saveActiveInputs(newSet); // Persist to localStorage
      return newSet;
    });

    debugLog.log('[GlobalBrowserMidi] Disconnected from input:', input.name);
    
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
      debugLog.log('[GlobalBrowserMidi] Refreshed MIDI devices:', inputList.map(i => i.name));
    }
  }, [midiAccess]);

  // Periodic cleanup of stale pending messages (every 100ms)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleKeys: string[] = [];
      
      // Check all pending messages and remove stale ones
      pendingMessageRef.current.forEach((message, key) => {
        const messageAge = now - (message.timestamp || 0);
        if (messageAge > MAX_MESSAGE_AGE_MS * 2) { // 2x threshold for cleanup
          staleKeys.push(key);
        }
      });
      
      // Remove stale messages
      staleKeys.forEach(key => {
        pendingMessageRef.current.delete(key);
        // Also cancel any associated timeout
        const timeout = throttleTimeoutRef.current.get(key);
        if (timeout) {
          clearTimeout(timeout);
          throttleTimeoutRef.current.delete(key);
        }
      });
      
      if (staleKeys.length > 0) {
        debugLog.log(`[GlobalBrowserMidi] Cleaned up ${staleKeys.length} stale pending messages`);
      }
    }, 100); // Check every 100ms
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Restore saved MIDI connections after midiAccess and connectBrowserInput are available
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (midiAccess && connectBrowserInput && !hasRestoredRef.current) {
      // Only restore once on initial load
      const savedInputs = loadSavedActiveInputs();
      if (savedInputs.size > 0) {
        debugLog.log('[GlobalBrowserMidi] Restoring saved MIDI connections:', Array.from(savedInputs));
        hasRestoredRef.current = true;
        // Restore connections after a short delay to ensure everything is initialized
        setTimeout(() => {
          savedInputs.forEach(inputId => {
            const input = midiAccess.inputs.get(inputId);
            if (input && input.state === 'connected') {
              // Only restore if the input is still available and connected
              connectBrowserInput(inputId);
            } else {
              console.warn('[GlobalBrowserMidi] Saved MIDI input not available:', inputId);
              // Remove from saved list if device is no longer available
              const newSet = new Set(savedInputs);
              newSet.delete(inputId);
              saveActiveInputs(newSet);
            }
          });
        }, 300);
      } else {
        hasRestoredRef.current = true; // Mark as restored even if no saved inputs
      }
    }
  }, [midiAccess, connectBrowserInput]); // Restore when both are ready

  // Cleanup: Remove all listeners and timeouts when component unmounts
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
            debugLog.log('[GlobalBrowserMidi] Cleaned up listener for:', inputId);
          }
        });
        handlerRefs.current.clear();
      }
      
      // Clear all pending timeouts
      throttleTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      throttleTimeoutRef.current.clear();
      pendingMessageRef.current.clear();
      lastMessageTimeRef.current.clear();
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
