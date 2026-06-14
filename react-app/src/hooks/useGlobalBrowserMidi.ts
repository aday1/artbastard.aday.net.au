import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import { detectTemplateForMidiInterface, getTemplateById } from '../components/midi/midiControllerTemplates';
import { debugLog } from '../utils/debugLog';
import { recordBrowserMidiMessage } from '../midi/midiTransportDedupe';
import { disconnectRoliLightpad, setRoliMidiAccess, isRoliblockLike } from '../engines/roliLightpad';
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
  const [serverRoliClaimed, setServerRoliClaimed] = useState(false);
  const serverRoliClaimedRef = useRef(false);
  const midiAccessRef = useRef<WebMidi.MIDIAccess | null>(null);
  
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
  // Input ids we have already auto-connected (or attempted to) in this session.
  // Once an id is in here, the auto-effect must not touch it again — manual
  // Connect/Disconnect owns it. Prevents the effect re-firing on activeInputs
  // changes and racing with a user click (which would strip the just-attached
  // handler and leave the device silently broken).
  const autoConnectAttemptedRef = useRef<Set<string>>(new Set());
  
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

  const closeRoliInputsForServer = useCallback((access: WebMidi.MIDIAccess | null) => {
    if (!access) return;
    Array.from(access.inputs.values()).forEach((input) => {
      if (!isRoliblockLike(input.name || '')) return;
      const handler = handlerRefs.current.get(input.id);
      if (handler) {
        input.removeEventListener('midimessage', handler);
        handlerRefs.current.delete(input.id);
      }
      input.onmidimessage = null;
      void input.close().catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    const applyServerRoliStatus = (status: any) => {
      const claimed = Boolean(status?.connected && (status?.inputName || status?.outputName));
      serverRoliClaimedRef.current = claimed;
      setServerRoliClaimed(claimed);
      if (claimed) {
        disconnectRoliLightpad();
        closeRoliInputsForServer(midiAccessRef.current);
        debugLog.log('[GlobalBrowserMidi] Browser ROLI engine deferred to server ROLI:', status);
      }
    };

    const cached = (window as any).__artbastardServerRoliStatus;
    if (cached) applyServerRoliStatus(cached);

    fetch('/api/roli/server/status')
      .then((response) => response.ok ? response.json() : null)
      .then((status) => status && applyServerRoliStatus(status))
      .catch(() => undefined);

    const onStatus = (event: Event) => applyServerRoliStatus((event as CustomEvent).detail);
    window.addEventListener('serverRoliStatus', onStatus);
    return () => window.removeEventListener('serverRoliStatus', onStatus);
  }, []);

  const maybeAutoApplyTemplate = useCallback(
    async (deviceName: string, inputId?: string) => {
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

      // Key by inputId too so a 2nd ROLI block (same name, different id) is
      // not blocked by the 1st block's in-flight apply.
      const key = `${templateId}:${deviceName}:${inputId ?? ''}`;
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
          try {
            const statusResponse = await fetch('/api/roli/server/status');
            const status = statusResponse.ok ? await statusResponse.json() : null;
            const claimed = Boolean(status?.connected && (status?.inputName || status?.outputName));
            serverRoliClaimedRef.current = claimed;
            setServerRoliClaimed(claimed);
          } catch {
            // Keep Web MIDI available if the status endpoint is not reachable yet.
          }

          // SysEx is required for ROLI Lightpad handshake. We request it once
          // up-front and hand the same MIDIAccess to the ROLI engine to avoid
          // a second prompt (Chrome treats SysEx as a separate permission, so
          // a second requestMIDIAccess with a different sysex flag silently
          // fails when the engine later tries to connect).
          const access = await navigator.requestMIDIAccess({ sysex: !serverRoliClaimedRef.current });
          if (cancelled) return;
          midiAccessRef.current = access;
          setMidiAccess(access);
          setBrowserMidiEnabled(true);
          if (!serverRoliClaimedRef.current) {
            setRoliMidiAccess(access);
          } else {
            closeRoliInputsForServer(access);
          }
          
          // Update inputs list
          const inputList = Array.from(access.inputs.values());
          setInputs(inputList);
          
          debugLog.log('[GlobalBrowserMidi] Web MIDI initialized successfully');
          
          // Listen for state changes without clobbering other Web MIDI users
          // such as APC40 LED feedback.
          const handleStateChange = () => {
            const newInputs = Array.from(access.inputs.values());
            setInputs(newInputs);
            if (!serverRoliClaimedRef.current) {
              setRoliMidiAccess(access);
            } else {
              closeRoliInputsForServer(access);
            }
            debugLog.log('[GlobalBrowserMidi] MIDI devices changed:', newInputs.map(i => i.name));
          };
          access.addEventListener('statechange', handleStateChange);
          stateChangeCleanup = () => access.removeEventListener('statechange', handleStateChange);
        } else {
          setError('Web MIDI API not supported in this browser');
          console.warn('[GlobalBrowserMidi] Web MIDI API not supported');
        }
      } catch (err: unknown) {
        console.error('[GlobalBrowserMidi] Failed to initialize Web MIDI with SysEx:', err);
        // SysEx may have been denied (browser policy or user refusal). Retry
        // without it so non-SysEx devices (APC40, generic CCs, etc.) still
        // work. ROLI handshake will fail visibly in the ROLI debug panel.
        try {
          const access = await navigator.requestMIDIAccess({ sysex: false });
          if (cancelled) return;
          midiAccessRef.current = access;
          setMidiAccess(access);
          setBrowserMidiEnabled(true);
          const inputList = Array.from(access.inputs.values());
          setInputs(inputList);
          if (serverRoliClaimedRef.current) closeRoliInputsForServer(access);
          const handleStateChange = () => {
            setInputs(Array.from(access.inputs.values()));
          };
          access.addEventListener('statechange', handleStateChange);
          stateChangeCleanup = () => access.removeEventListener('statechange', handleStateChange);
          setError('SysEx denied — ROLI Lightpad will not work. Re-grant via site permissions.');
        } catch (retryErr: unknown) {
          const errorMessage = retryErr instanceof Error ? retryErr.message : 'Unknown error';
          setError(errorMessage);
        }
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

    if (serverRoliClaimedRef.current && isRoliblockLike(input.name || '')) {
      debugLog.log('[GlobalBrowserMidi] Browser ROLI input deferred to server:', input.name);
      return;
    }

    // ROLI Lightpad inputs are owned by the roliLightpad engine. Attaching a
    // generic listener here breaks the engine's onmidimessage handler (the two
    // mechanisms cannot coexist on the same input). Skip — the engine handles
    // its own connect/disconnect via setRoliMidiAccess.
    if (isRoliblockLike(input.name || '')) {
      debugLog.log('[GlobalBrowserMidi] Skipping ROLI input (managed by roliLightpad engine):', input.name);
      return;
    }

    // Once a user (or the auto-effect) has touched this id, the auto-effect
    // must back off — see autoConnectAttemptedRef comment.
    autoConnectAttemptedRef.current.add(inputId);

    // Idempotent: if we already own a live handler for this id, do nothing.
    // The previous strip-then-reattach pattern was racy — a concurrent caller
    // (manual click + auto-effect) could wipe the just-attached handler and
    // leave activeInputs out of sync with handlerRefs, which is the "Connected
    // but no MIDI flowing / Connect button does nothing" symptom.
    if (handlerRefs.current.has(inputId)) {
      debugLog.log('[GlobalBrowserMidi] Already connected to:', input.name);
      setActiveInputs(prev => {
        if (prev.has(inputId)) return prev;
        const newSet = new Set([...prev, inputId]);
        saveActiveInputs(newSet);
        return newSet;
      });
      return;
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

      // ROLI Lightpad inputs are engine-owned (see connectBrowserInput).
      // Don't dispatch detection events or auto-attach generic listeners.
      if (isRoliblockLike(input.name || '')) return;

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
      // pre-prompt behavior for recognised controllers. We only attempt this
      // ONCE per input id per session — the autoConnectAttemptedRef guard
      // prevents the effect re-firing on activeInputs changes and racing
      // with a user-initiated Connect/Disconnect click.
      const templateId = detectTemplateForMidiInterface(input.name || '');
      if (
        templateId &&
        !activeInputs.has(input.id) &&
        !handlerRefs.current.has(input.id) &&
        !autoConnectAttemptedRef.current.has(input.id)
      ) {
        autoConnectAttemptedRef.current.add(input.id);
        void maybeAutoApplyTemplate(input.name || '', input.id);
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
  }, [midiAccess, inputs, activeInputs, connectBrowserInput, maybeAutoApplyTemplate, serverRoliClaimed]);

  useEffect(() => {
    const handleConnectBrowser = (event: Event) => {
      const controller = (event as CustomEvent<DetectedMidiController>).detail;
      if (!midiAccess || !controller || controller.transport !== 'browser') return;
      if (!midiAccess.inputs.has(controller.id)) return;
      if (controller.templateId) void maybeAutoApplyTemplate(controller.name, controller.id);
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

    // Mark as user-touched so the auto-effect won't reconnect against the
    // user's explicit disconnect intent.
    autoConnectAttemptedRef.current.add(inputId);

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

  // Release the OS-level lock on a browser MIDI input. On Windows, Chrome's
  // Web MIDI claims every device exclusively the moment requestMIDIAccess
  // resolves, which blocks the backend's RtMidi from opening the same port.
  // Calling input.close() drops our claim; once released, the user can
  // connect the device via Server MIDI instead. The Connect button on this
  // row will become unresponsive until the user refreshes (the input may
  // still appear in the list because the MIDIAccess object retains it).
  const releaseBrowserInput = useCallback(async (inputId: string) => {
    if (!midiAccess) return;
    const input = midiAccess.inputs.get(inputId);
    if (!input) return;

    // Detach any handler we own first so messages don't fire during close.
    const handler = handlerRefs.current.get(inputId);
    if (handler) {
      input.removeEventListener('midimessage', handler);
      handlerRefs.current.delete(inputId);
    }
    if (input.onmidimessage) input.onmidimessage = null;

    setActiveInputs(prev => {
      if (!prev.has(inputId)) return prev;
      const newSet = new Set(prev);
      newSet.delete(inputId);
      saveActiveInputs(newSet);
      return newSet;
    });
    // Block the auto-effect from re-opening this id behind the user's back.
    autoConnectAttemptedRef.current.add(inputId);

    try {
      await input.close();
      debugLog.log('[GlobalBrowserMidi] Released input:', input.name);
      addNotification({
        message: `Released ${input.name} from browser — backend can now use it via Server MIDI`,
        type: 'info',
        priority: 'normal',
      });
    } catch (err) {
      console.error('[GlobalBrowserMidi] Failed to release input:', err);
      addNotification({
        message: `Could not release ${input.name}: ${err instanceof Error ? err.message : 'unknown error'}`,
        type: 'error',
        priority: 'high',
      });
    }
  }, [midiAccess, addNotification]);

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
    serverRoliClaimed,
    connectBrowserInput,
    disconnectBrowserInput,
    releaseBrowserInput,
    refreshDevices,
  };
};
