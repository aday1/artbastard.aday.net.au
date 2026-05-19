import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useStore } from '../store';

/**
 * Hook to sync localStorage changes across all connected clients via WebSocket
 * This enables real-time synchronization between desktop, mobile, and other devices
 */
export const useLocalStorageSync = () => {
  const { socket, connected } = useSocket();
  const isSyncingRef = useRef(false);
  const syncKeysRef = useRef<Set<string>>(new Set([
    'dmxChannelNames',
    'dmxChannelRanges',
    'dmxChannelColors',
    'pinnedChannels',
    'envelopeAutomation',
    'artbastard-auto-scene-settings',
    'theme',
    'darkMode',
    'uiSettings',
    'fixtureTemplates',
    'pinnedChannelsWidth'
  ]));

  useEffect(() => {
    if (!socket || !connected) return;

    // Watch for localStorage changes and sync them
    const handleStorageChange = (e: StorageEvent) => {
      // Ignore changes from other tabs (they're already synced via storage event)
      if (e.key && syncKeysRef.current.has(e.key) && !isSyncingRef.current) {
        try {
          const value = e.newValue ? JSON.parse(e.newValue) : null;
          socket.emit('localStorageSync', {
            key: e.key,
            value: value,
            sourceId: socket.id
          });
          console.log('[LocalStorageSync] Synced localStorage change:', e.key);
        } catch (error) {
          console.error('[LocalStorageSync] Failed to sync localStorage change:', error);
        }
      }
    };

    // Intercept localStorage.setItem to sync changes
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const syncLocalStorageChange = (key: string, value: string | null) => {
      if (syncKeysRef.current.has(key) && socket && connected && !isSyncingRef.current) {
        try {
          if (value === null) {
            socket.emit('localStorageSync', {
              key,
              value: null,
              sourceId: socket.id
            });
          } else {
            const parsedValue = JSON.parse(value);
            socket.emit('localStorageSync', {
              key,
              value: parsedValue,
              sourceId: socket.id
            });
          }
          console.log('[LocalStorageSync] Synced localStorage change:', key);
        } catch {
          // If not JSON, send as string
          socket.emit('localStorageSync', {
            key,
            value: value,
            sourceId: socket.id
          });
        }
      }
    };

    localStorage.setItem = function(key: string, value: string) {
      originalSetItem(key, value);
      syncLocalStorageChange(key, value);
    };

    // Intercept localStorage.removeItem
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function(key: string) {
      originalRemoveItem(key);
      syncLocalStorageChange(key, null);
    };

    // Listen for synced updates from other clients
    const handleSyncedUpdate = (e: CustomEvent) => {
      isSyncingRef.current = true;
      const { key, value } = e.detail;
      
      // Update the store if needed using Zustand's setState
      if (key === 'dmxChannelNames' && Array.isArray(value)) {
        useStore.setState({ channelNames: value });
      } else if (key === 'dmxChannelRanges' && Array.isArray(value)) {
        useStore.setState({ channelRanges: value });
      } else if (key === 'dmxChannelColors' && Array.isArray(value)) {
        useStore.setState({ channelColors: value });
      } else if (key === 'pinnedChannels' && Array.isArray(value)) {
        useStore.setState({ pinnedChannels: value });
      } else if (key === 'envelopeAutomation' && value && typeof value === 'object') {
        useStore.setState({ 
          envelopeAutomation: {
            ...value,
            globalEnabled: false, // Don't auto-enable on sync
            animationId: null
          }
        });
      }
      
      // Also trigger storage event for other listeners
      window.dispatchEvent(new Event('storage'));
      
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageSynced', handleSyncedUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageSynced', handleSyncedUpdate as EventListener);
      // Restore original methods
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
    };
  }, [socket, connected]);

  // Function to manually sync all localStorage data (for initial sync)
  const syncAllLocalStorage = () => {
    if (!socket || !connected) return;

    const allData: { [key: string]: any } = {};
    syncKeysRef.current.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          allData[key] = JSON.parse(value);
        } catch {
          allData[key] = value;
        }
      }
    });

    socket.emit('localStorageBulkSync', {
      data: allData,
      sourceId: socket.id
    });
    console.log('[LocalStorageSync] Synced all localStorage data:', Object.keys(allData).length, 'keys');
  };

  return { syncAllLocalStorage };
};

