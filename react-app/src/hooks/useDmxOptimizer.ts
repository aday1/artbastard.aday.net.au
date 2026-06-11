/**
 * Hook for DMX Optimizer Integration
 * Provides optimized DMX update functionality using dmxOptimizer
 */

import { useEffect, useRef, useCallback } from 'react';
import DmxOptimizer from '../utils/dmxOptimizer';
import { useStore } from '../store';

/**
 * Hook to use DMX optimizer for batch updates
 */
export function useDmxOptimizer() {
  const setMultipleDmxChannels = useStore(state => state.setMultipleDmxChannels);
  const optimizerRef = useRef<DmxOptimizer | null>(null);

  // Initialize optimizer
  useEffect(() => {
    optimizerRef.current = new DmxOptimizer(
      (updates) => {
        // Send batched updates to backend
        setMultipleDmxChannels(updates, true);
      },
      {
        maxUpdatesPerFrame: 512,
        throttleMs: 16, // ~60fps
        changeThreshold: 1, // Minimum change to send
        batchSize: 512
      }
    );

    return () => {
      if (optimizerRef.current) {
        optimizerRef.current.clear();
        optimizerRef.current = null;
      }
    };
  }, [setMultipleDmxChannels]);

  // Optimized update function
  const updateDmxChannel = useCallback((channel: number, value: number) => {
    if (optimizerRef.current) {
      optimizerRef.current.queueUpdate(channel, value);
    } else {
      // Fallback to direct update if optimizer not ready
      setMultipleDmxChannels({ [channel]: value }, true);
    }
  }, [setMultipleDmxChannels]);

  // Optimized batch update function
  const updateDmxChannels = useCallback((updates: Record<number, number>) => {
    if (optimizerRef.current) {
      optimizerRef.current.queueUpdates(updates);
    } else {
      // Fallback to direct update if optimizer not ready
      setMultipleDmxChannels(updates, true);
    }
  }, [setMultipleDmxChannels]);

  // Force immediate flush
  const flushUpdates = useCallback(() => {
    if (optimizerRef.current) {
      optimizerRef.current.flushImmediate();
    }
  }, []);

  // Get pending count
  const getPendingCount = useCallback(() => {
    return optimizerRef.current?.getPendingCount() || 0;
  }, []);

  return {
    updateDmxChannel,
    updateDmxChannels,
    flushUpdates,
    getPendingCount
  };
}

