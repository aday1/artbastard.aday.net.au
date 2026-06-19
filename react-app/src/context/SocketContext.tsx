import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store'; // Import Zustand store
import {
  mergeFixtureTemplatesWithCatalog,
  refreshFixtureCatalogPhotos,
} from '../store/fixtureCatalogSync';
import { handleActTriggerAction } from './actTriggerHandler';
import { debugLog } from '../utils/debugLog';
import { isLikelyDuplicateServerMidiMessage } from '../midi/midiTransportDedupe';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

// Create context with default values
const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  error: null,
  reconnect: () => { }
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initSocket = () => {
    try {
      // Clear any previous errors
      setError(null);

      // Initialize socket with error handling
      debugLog.log('Initializing Socket.IO connection');

      // Use window.location to automatically connect to the correct host
      const socketUrl = process.env.NODE_ENV === 'production'
        ? window.location.origin
        : 'http://localhost:3030'; // Explicitly set the backend URL in development (Updated to 3030)

      debugLog.log(`[SocketContext] Connecting to socket at: ${socketUrl}`);

      const sessionId = (() => {
        try {
          const fromUrl = new URLSearchParams(window.location.search).get('sessionId');
          if (fromUrl && fromUrl.trim()) {
            const sid = fromUrl.trim().slice(0, 64);
            localStorage.setItem('artbastard-session-id', sid);
            return sid;
          }
          const v = localStorage.getItem('artbastard-session-id');
          return v && v.trim() ? v.trim().slice(0, 64) : 'default';
        } catch {
          return 'default';
        }
      })();
      useStore.getState().setActiveSessionId(sessionId);

      const socketInstance = io(socketUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: true,
        autoConnect: true,
        transports: ['websocket', 'polling'],
        auth: { sessionId },
      });

      socketInstance.on('connect', () => {
        debugLog.log('Socket.IO connected');
        setConnected(true);
        setError(null);

        // Fetch initial state from server when connected
        const store = useStore.getState();
        store.fetchInitialState().catch(error => {
          console.error('Failed to fetch initial state:', error);
        });
      });

      socketInstance.on('disconnect', (reason) => {
        debugLog.log(`Socket.IO disconnected: ${reason}`);
        setConnected(false);
      });

      socketInstance.on('connect_error', (err) => {
        console.error(`Socket.IO connection error: ${err.message}`);
        setConnected(false);
        setError(`Connection error: ${err.message}`);
      });

      socketInstance.on('error', (err) => {
        console.error(`Socket.IO error: ${err}`);
        setError(`Socket error: ${err}`);
      });

      // Handle JSON parsing errors specifically
      socketInstance.on('parse_error', (err) => {
        console.error(`Socket.IO parse error: ${err}`);
        setError(`Data parsing error. Try refreshing the page.`);
      });

      socketInstance.on('midiMessage', (msg: any) => {
        const normalizedType = msg?.type || msg?._type;
        if (!normalizedType) return;
        const normalizedMessage = {
          ...msg,
          type: normalizedType,
          _type: normalizedType,
          source: msg?.source || 'server',
          sourceTransport: msg?.sourceTransport || 'server',
        };

        if (isLikelyDuplicateServerMidiMessage(normalizedMessage)) {
          debugLog.log('[SocketContext] Dropping duplicate server MIDI echo:', normalizedMessage);
          return;
        }

        useStore.getState().addMidiMessage(normalizedMessage);
      });

      socketInstance.on('serverLog', (entry: any) => {
        window.dispatchEvent(new CustomEvent('serverLog', { detail: entry }));
      });

      socketInstance.on('serverRoliStatus', (status: any) => {
        (window as any).__artbastardServerRoliStatus = status;
        window.dispatchEvent(new CustomEvent('serverRoliStatus', { detail: status }));
      });

      socketInstance.on('serverRoliTouch', (touch: any) => {
        window.dispatchEvent(new CustomEvent('serverRoliTouch', { detail: touch }));
      });

      const dispatchServerMidiInputsActive = (inputs: string[]) => {
        const activeInputs = Array.isArray(inputs) ? inputs : [];
        (window as any).__artbastardServerMidiInputsActive = activeInputs;
        window.dispatchEvent(new CustomEvent('serverMidiInputsActive', { detail: activeInputs }));
      };

      socketInstance.on('midiInputsActive', dispatchServerMidiInputsActive);
      socketInstance.on('activeMidiInterfaces', dispatchServerMidiInputsActive);

      socketInstance.on('oscChannelActivity', (data: { channelIndex: number; value: number }) => {
        useStore.getState().reportOscActivity(data.channelIndex, data.value);
      });

      const forwardBrowserMidiStatus = (event: Event) => {
        socketInstance.emit('browserMidiStatus', (event as CustomEvent).detail || {});
      };
      const forwardBrowserMidiMonitor = (event: Event) => {
        socketInstance.emit('browserMidiMonitor', (event as CustomEvent).detail || {});
      };
      window.addEventListener('artbastard:browser-midi-status', forwardBrowserMidiStatus);
      window.addEventListener('artbastard:browser-midi-monitor', forwardBrowserMidiMonitor);

      // Listen for masterClockUpdate from backend
      socketInstance.on('masterClockUpdate', (data: any) => {
        debugLog.log('[SocketContext] Received masterClockUpdate:', data);
        const normalizeMidiClockInputStatus = (status: unknown) =>
          status === 'none' || status === 'selected' || status === 'listening' || status === 'receiving'
            ? status
            : undefined;
        const {
          setMidiClockBpm,
          setMidiClockIsPlaying,
          setSelectedMidiClockHostId,
          setMidiClockBeatBar,
          setMidiClockInputTelemetry,
        } = useStore.getState();

        if (data && typeof data.bpm === 'number') {
          setMidiClockBpm(data.bpm, false);
        }
        if (data && typeof data.isPlaying === 'boolean') {
          setMidiClockIsPlaying(data.isPlaying);
        }
        if (data && typeof data.source === 'string') {
          setSelectedMidiClockHostId(data.source);
        }
        if (data && typeof data.beat === 'number' && typeof data.bar === 'number') {
          setMidiClockBeatBar(data.beat, data.bar);
        }
        if (data && (
          'midiClockInputName' in data ||
          'externalMidiClockSourceName' in data ||
          'externalMidiClockLastSeenAt' in data ||
          'midiClockInputStatus' in data
        )) {
          setMidiClockInputTelemetry({
            selectedInputName:
              data.midiClockInputName === undefined ? undefined : data.midiClockInputName,
            lastInputName:
              data.externalMidiClockSourceName === undefined ? undefined : data.externalMidiClockSourceName,
            lastInputAt:
              data.externalMidiClockLastSeenAt === undefined ? undefined : data.externalMidiClockLastSeenAt,
            status: normalizeMidiClockInputStatus(data.midiClockInputStatus),
          });
        }
        if (data && (typeof data.linkPeers === 'number' || typeof data.linkAvailable === 'boolean')) {
          useStore.setState({
            abletonLinkPeers: typeof data.linkPeers === 'number' ? data.linkPeers : useStore.getState().abletonLinkPeers,
            abletonLinkAvailable: typeof data.linkAvailable === 'boolean' ? data.linkAvailable : useStore.getState().abletonLinkAvailable,
          });
        }
      });

      socketInstance.on('session:joined', (payload: {
        sessionId?: string;
        dmxChannels?: number[];
      }) => {
        if (payload?.sessionId) {
          useStore.getState().setActiveSessionId(payload.sessionId);
        }
        if (payload?.dmxChannels && Array.isArray(payload.dmxChannels)) {
          const updates: Record<number, number> = {};
          payload.dmxChannels.forEach((value, index) => {
            updates[index] = value;
          });
          useStore.getState().setMultipleDmxChannels(updates, false);
        }
      });

      socketInstance.on('sessions:list', (payload: {
        sessions?: Array<{
          id: string;
          name: string;
          clientCount: number;
          bridgeConnected: boolean;
          bridgeId?: string;
        }>;
        defaultSessionId?: string;
      }) => {
        if (payload?.sessions) {
          useStore.getState().setSessionsList(payload.sessions, payload.defaultSessionId);
        }
      });

      socketInstance.on('session:error', (payload: { message?: string }) => {
        useStore.getState().addNotification({
          message: payload?.message || 'Session error',
          type: 'error',
          priority: 'high',
        });
      });

      socketInstance.on('bridge:registry', (payload: {
        connected?: boolean;
        bridge?: unknown;
        connectedClients?: number;
        sessionId?: string;
      }) => {
        const { setBridgeRegistry } = useStore.getState();
        if (payload && typeof payload.connected === 'boolean') {
          setBridgeRegistry({
            connected: payload.connected,
            bridge: (payload.bridge as Parameters<typeof setBridgeRegistry>[0]['bridge']) || null,
            connectedClients: payload.connectedClients,
          });
        }
      });

      // Listen for availableClockSources from backend
      socketInstance.on('availableClockSources', (sources: Array<{ id: string; name: string }>) => {
        debugLog.log('[SocketContext] Received availableClockSources:', sources);
        const { setAvailableMidiClockHosts } = useStore.getState();
        if (Array.isArray(sources)) {
          setAvailableMidiClockHosts(sources);
        }
      });

      // Listen for MIDI clock input list
      socketInstance.on('midiClockInputs', (payload: { inputs: string[]; currentInput: string | null }) => {
        debugLog.log('[SocketContext] Received midiClockInputs:', payload);
        useStore.getState().setMidiClockInputs(payload.inputs || [], payload.currentInput ?? null);
      });

      // Listen for MIDI clock input changed broadcast
      socketInstance.on('midiClockInputChanged', ({ inputName, status }: { inputName: string; status?: any }) => {
        debugLog.log('[SocketContext] MIDI clock input changed to:', inputName);
        const normalizedStatus =
          status === 'none' || status === 'selected' || status === 'listening' || status === 'receiving'
            ? status
            : 'selected';
        useStore.getState().setMidiClockInputTelemetry({
          selectedInputName: inputName || null,
          status: normalizedStatus,
        });
      });

      // Listen for DMX channel updates from backend
      socketInstance.on('dmxUpdate', ({ channel, value }: { channel: number; value: number }) => {
        debugLog.log('[SocketContext] Received DMX update:', { channel, value });
        // Update the store with the new DMX channel value (don't send back to backend to avoid loops)
        const store = useStore.getState();
        store.setDmxChannel(channel, value, false);
      });

      // Listen for restored DMX state from backend (on startup)
      socketInstance.on('dmxStateRestored', ({ dmxChannels }: { dmxChannels: number[] }) => {
        debugLog.log('[SocketContext] Received restored DMX state:', dmxChannels.length, 'channels');
        debugLog.log('[SocketContext] Non-zero channels:', dmxChannels.filter(val => val > 0).length);

        // Update all DMX channels with the restored state using bulk update
        const updates: Record<number, number> = {};
        dmxChannels.forEach((value, index) => {
          updates[index] = value;
        });

        const store = useStore.getState();
        store.setMultipleDmxChannels(updates, false); // Don't send back to backend to avoid loops
        debugLog.log('[SocketContext] Applied restored DMX state to frontend');
      });

      // Listen for ACT trigger events from backend (OSC/MIDI triggers)
      socketInstance.on('actTrigger', ({ actId, action, triggerId }: { actId: string; action: string; triggerId: string }) => {
        debugLog.log('[SocketContext] Received ACT trigger:', { actId, action, triggerId });
        const store = useStore.getState();
        const handled = handleActTriggerAction(store, actId, action);
        if (!handled) {
          console.warn('[SocketContext] Unknown ACT trigger action:', action);
        }
      });

      // Listen for ACTS save events from frontend
      const handleSaveActs = (event: CustomEvent) => {
        debugLog.log('[SocketContext] Saving ACTS to backend:', event.detail.length, 'acts');
        socketInstance.emit('saveActs', event.detail);
      };

      window.addEventListener('saveActsToBackend', handleSaveActs as EventListener);

      // Listen for initialState event (sent on connection)
      socketInstance.on('initialState', (state: any) => {
        debugLog.log('[SocketContext] Received initialState from backend:', {
          fixtures: state.fixtures?.length || 0,
          groups: state.groups?.length || 0,
          scenes: state.scenes?.length || 0,
          fixtureTemplates: state.fixtureTemplates?.length || 0
        });
        const store = useStore.getState();
        if (state.fixtures && Array.isArray(state.fixtures)) {
          // Normalize fixtures to ensure they have required fields
          const normalizedFixtures = state.fixtures.map((fixture: any, index: number) => {
            if (!fixture.id) {
              fixture.id = `fixture-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!fixture.type) {
              fixture.type = 'generic';
            }
            return fixture;
          });
          debugLog.log('[SocketContext] Setting fixtures from initialState:', normalizedFixtures.length);
          debugLog.log('[SocketContext] Fixture IDs:', normalizedFixtures.map((f: any) => f.id));
          store.setFixtures(normalizedFixtures);
        }
        if (state.groups && Array.isArray(state.groups)) {
          store.setGroups(state.groups);
        }
        if (state.fixtureLayout && Array.isArray(state.fixtureLayout)) {
          store.setFixtureLayout(state.fixtureLayout);
        }
        // Sync custom profile copies from server while keeping the canonical catalog protected.
        if (state.fixtureTemplates && Array.isArray(state.fixtureTemplates)) {
          const serverTemplates = state.fixtureTemplates;
          const mergedTemplates = mergeFixtureTemplatesWithCatalog(serverTemplates);
          // Update localStorage with custom profiles only.
          const customTemplates = mergedTemplates.filter(t => !t.isBuiltIn);
          try {
            localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
          } catch (e) {
            console.warn('Failed to save templates to localStorage:', e);
          }
          // Update store (direct assignment since there's no setter, but this will trigger re-renders via Zustand)
          useStore.setState({
            fixtureTemplates: mergedTemplates,
            fixtures: refreshFixtureCatalogPhotos(useStore.getState().fixtures, mergedTemplates),
          });
          debugLog.log('[SocketContext] Synced fixture profiles from server:', serverTemplates.length, 'custom profiles');
        }
      });

      // Listen for fixtures updates from backend (multi-window sync)
      socketInstance.on('fixturesUpdated', (fixturesData: any[]) => {
        debugLog.log('[SocketContext] Received fixtures update from backend:', fixturesData.length, 'fixtures');
        const store = useStore.getState();
        if (Array.isArray(fixturesData)) {
          // Normalize fixtures to ensure they have required fields
          const normalizedFixtures = fixturesData.map((fixture: any, index: number) => {
            if (!fixture.id) {
              fixture.id = `fixture-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!fixture.type) {
              fixture.type = 'generic';
            }
            return fixture;
          });
          store.setFixtures(normalizedFixtures);
        }
      });

      socketInstance.on('fixturesUpdate', (fixturesData: any[]) => {
        debugLog.log('[SocketContext] Received fixtures update (fixturesUpdate) from backend:', fixturesData.length, 'fixtures');
        const store = useStore.getState();
        if (Array.isArray(fixturesData)) {
          // Normalize fixtures to ensure they have required fields
          const normalizedFixtures = fixturesData.map((fixture: any, index: number) => {
            if (!fixture.id) {
              fixture.id = `fixture-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!fixture.type) {
              fixture.type = 'generic';
            }
            return fixture;
          });
          store.setFixtures(normalizedFixtures);
        }
      });

      // Listen for fixture profile updates from backend.
      socketInstance.on('fixtureTemplatesUpdated', (templatesData: any[]) => {
        debugLog.log('[SocketContext] Received fixture profiles update from backend:', templatesData.length, 'profiles');
        const store = useStore.getState();
        if (Array.isArray(templatesData)) {
          const mergedTemplates = mergeFixtureTemplatesWithCatalog(templatesData);
          // Update localStorage with custom profiles only.
          const customTemplates = mergedTemplates.filter(t => !t.isBuiltIn);
          try {
            localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
          } catch (e) {
            console.warn('Failed to save templates to localStorage:', e);
          }
          // Update store (direct assignment since there's no setter, but this will trigger re-renders via Zustand)
          useStore.setState({
            fixtureTemplates: mergedTemplates,
            fixtures: refreshFixtureCatalogPhotos(store.fixtures, mergedTemplates),
          });
        }
      });

      socketInstance.on('fixturesLoaded', (fixturesData: any[]) => {
        debugLog.log('[SocketContext] Received fixtures loaded from backend:', fixturesData.length, 'fixtures');
        const store = useStore.getState();
        if (Array.isArray(fixturesData)) {
          // Normalize fixtures to ensure they have required fields
          const normalizedFixtures = fixturesData.map((fixture: any, index: number) => {
            if (!fixture.id) {
              fixture.id = `fixture-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            }
            if (!fixture.type) {
              fixture.type = 'generic';
            }
            return fixture;
          });
          debugLog.log('[SocketContext] Setting fixtures from fixturesLoaded:', normalizedFixtures.length);
          debugLog.log('[SocketContext] Fixture details:', normalizedFixtures.map((f: any) => ({ id: f.id, name: f.name, startAddress: f.startAddress })));
          store.setFixtures(normalizedFixtures);
        }
      });

      // Listen for groups updates from backend (multi-window sync)
      socketInstance.on('groupsUpdated', (groupsData: any[]) => {
        debugLog.log('[SocketContext] Received groups update from backend:', groupsData.length, 'groups');
        const store = useStore.getState();
        store.setGroups(groupsData);
      });

      socketInstance.on('groupsLoaded', (groupsData: any[]) => {
        debugLog.log('[SocketContext] Received groups loaded from backend:', groupsData.length, 'groups');
        const store = useStore.getState();
        store.setGroups(groupsData);
      });

      socketInstance.on('fixtureLayoutUpdate', (layoutData: any[]) => {
        debugLog.log('[SocketContext] Received fixture layout update from backend:', layoutData.length, 'items');
        const store = useStore.getState();
        if (Array.isArray(layoutData)) {
          store.setFixtureLayout(layoutData);
        }
      });

      // Listen for quick scene save/load events
      socketInstance.on('quickSceneSaved', (data: { name: string; slot?: number; timestamp: number }) => {
        debugLog.log('[SocketContext] Quick scene saved:', data.name);
        const store = useStore.getState();
        store.addNotification({
          message: `Quick scene saved: ${data.name}`,
          type: 'success',
          priority: 'low'
        });
      });

      socketInstance.on('quickSceneLoaded', (data: { name: string; slot?: number; timestamp: number }) => {
        debugLog.log('[SocketContext] Quick scene loaded:', data.name);
        const store = useStore.getState();
        store.addNotification({
          message: `Quick scene loaded: ${data.name}`,
          type: 'info',
          priority: 'low'
        });
      });

      socketInstance.on('quickSceneLoadError', (data: { slot: number; error: string }) => {
        debugLog.log('[SocketContext] Quick scene load error:', data.error);
        const store = useStore.getState();
        store.addNotification({
          message: `Quick scene load failed: ${data.error}`,
          type: 'error',
          priority: 'low'
        });
      });

      // Listen for localStorage sync updates from other clients
      socketInstance.on('localStorageUpdate', ({ key, value, sourceId }: { key: string; value: any; sourceId: string }) => {
        // Don't process our own updates (avoid loops)
        if (sourceId === socketInstance.id) return;

        debugLog.log('[SocketContext] Received localStorage update from another client:', { key, sourceId });
        try {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }

          // Trigger a custom event so components can react to the change
          window.dispatchEvent(new CustomEvent('localStorageSynced', { detail: { key, value } }));
        } catch (error) {
          console.error('[SocketContext] Failed to sync localStorage update:', error);
        }
      });

      // Listen for bulk localStorage sync updates
      socketInstance.on('localStorageBulkUpdate', ({ data, sourceId }: { data: { [key: string]: any }; sourceId: string }) => {
        // Don't process our own updates
        if (sourceId === socketInstance.id) return;

        debugLog.log('[SocketContext] Received bulk localStorage update from another client:', { keysCount: Object.keys(data).length, sourceId });
        try {
          for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
              localStorage.setItem(key, value);
            } else {
              localStorage.setItem(key, JSON.stringify(value));
            }
          }

          // Trigger a custom event for bulk update
          window.dispatchEvent(new CustomEvent('localStorageBulkSynced', { detail: { data } }));
        } catch (error) {
          console.error('[SocketContext] Failed to sync bulk localStorage update:', error);
        }
      });

      // Listen for scene loaded events from backend
      socketInstance.on('sceneLoaded', ({ name, channelValues }: { name: string; channelValues: number[] }) => {
        debugLog.log('[SocketContext] Received scene loaded:', { name, channelValues });
        debugLog.log('[SocketContext] Channel values length:', channelValues.length);
        debugLog.log('[SocketContext] First 10 channel values:', channelValues.slice(0, 10));

        const store = useStore.getState();
        if (store.isTransitioning) {
          debugLog.log('[SocketContext] Ignoring backend sceneLoaded during client scene transition');
          return;
        }

        // Update all DMX channels with the scene values using bulk update
        const updates: Record<number, number> = {};
        channelValues.forEach((value, index) => {
          updates[index] = value;
        });
        debugLog.log('[SocketContext] About to call setMultipleDmxChannels with updates:', Object.keys(updates).length, 'channels');
        store.setMultipleDmxChannels(updates, false); // Don't send back to backend to avoid loops
        debugLog.log('[SocketContext] Applied scene values to DMX channels');
      });

      setSocket(socketInstance);

      // Cleanup function
      return () => {
        debugLog.log('Cleaning up Socket.IO connection');
        if (socketInstance) {
          socketInstance.off('masterClockUpdate');
          socketInstance.off('session:joined');
          socketInstance.off('sessions:list');
          socketInstance.off('session:error');
          socketInstance.off('bridge:registry');
          socketInstance.off('availableClockSources');
          socketInstance.off('midiInputsActive');
          socketInstance.off('activeMidiInterfaces');
          socketInstance.off('serverRoliTouch');
          socketInstance.off('midiClockInputs');
          socketInstance.off('midiClockInputChanged');
          socketInstance.off('dmxUpdate');
          socketInstance.off('dmxStateRestored');
          socketInstance.off('sceneLoaded');
          socketInstance.off('initialState');
          socketInstance.off('fixturesUpdated');
          socketInstance.off('fixturesUpdate');
          socketInstance.off('fixturesLoaded');
          socketInstance.off('groupsUpdated');
          socketInstance.off('groupsLoaded');
          socketInstance.off('fixtureLayoutUpdate');
          socketInstance.off('quickSceneSaved');
          socketInstance.off('quickSceneLoaded');
          socketInstance.off('quickSceneLoadError');
          socketInstance.off('localStorageUpdate');
          socketInstance.off('localStorageBulkUpdate');
          socketInstance.disconnect();
        }
        window.removeEventListener('artbastard:browser-midi-status', forwardBrowserMidiStatus);
        window.removeEventListener('artbastard:browser-midi-monitor', forwardBrowserMidiMonitor);
        window.removeEventListener('saveActsToBackend', handleSaveActs as EventListener);
        setSocket(null);
        setConnected(false);
      };
    } catch (err) {
      console.error('Error initializing Socket.IO:', err);
      setError(`Failed to initialize connection: ${err instanceof Error ? err.message : String(err)}`);
      return () => { };
    }
  };

  // Initialize socket on component mount
  useEffect(() => {
    const cleanup = initSocket();
    return cleanup;
  }, []);

  // Function to manually reconnect
  const reconnect = () => {
    debugLog.log('[SocketContext] Manual reconnection requested');
    if (socket) {
      debugLog.log('[SocketContext] Disconnecting existing socket...');
      socket.disconnect();
      socket.connect(); // Try to reconnect the existing socket first
      debugLog.log('[SocketContext] Socket reconnection initiated');
    } else {
      debugLog.log('[SocketContext] No socket instance, creating new one');
      initSocket();
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, error, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  // The dynamic import of useStore for window.useStore can remain if it serves other purposes,
  // but for the listeners added above, the direct import of useStore is used.
  return useContext(SocketContext);
};

export type { SocketContextType }; // Exporting type separately

export default SocketContext;
