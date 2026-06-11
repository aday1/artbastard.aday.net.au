/**
 * Hook for Monitoring Service Integration
 * Provides monitoring capabilities throughout the application
 */

import { useEffect, useCallback } from 'react';
import { monitoringService } from '../utils/monitoring';
import { useStore } from '../store';

/**
 * Hook to use monitoring service
 */
export function useMonitoring(componentName?: string) {
  const dmxChannels = useStore(state => state.dmxChannels);
  const setMultipleDmxChannels = useStore(state => state.setMultipleDmxChannels);

  // Record component render performance
  useEffect(() => {
    if (!componentName) return;

    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    if (typeof performance !== 'undefined') {
      performance.mark(startMark);

      return () => {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        
        const measure = performance.getEntriesByName(measureName)[0];
        if (measure) {
          monitoringService.recordMetric({
            name: `${componentName}-render-time`,
            value: measure.duration,
            unit: 'ms',
            tags: { component: componentName }
          });
        }
      };
    }
  }, [componentName]);

  // Record DMX traffic
  const recordDmxUpdate = useCallback((channel: number, value: number, source: 'manual' | 'scene' | 'automation' | 'midi' | 'osc' = 'manual') => {
    monitoringService.recordDmxTraffic({
      universe: 0, // TODO: Support multi-universe
      channel,
      value,
      source
    });
  }, []);

  // Record feature usage
  const recordUsage = useCallback((feature: string, action: string, metadata?: Record<string, any>) => {
    monitoringService.recordUsage({
      feature,
      action,
      metadata
    });
  }, []);

  // Record error
  const recordError = useCallback((error: Error, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', component?: string) => {
    monitoringService.recordError({
      message: error.message,
      stack: error.stack,
      component: component || componentName,
      severity
    });
  }, [componentName]);

  return {
    recordDmxUpdate,
    recordUsage,
    recordError,
    getMetrics: monitoringService.getMetrics.bind(monitoringService),
    getErrors: monitoringService.getErrors.bind(monitoringService),
    getDmxTraffic: monitoringService.getDmxTraffic.bind(monitoringService),
    getDmxTrafficStats: monitoringService.getDmxTrafficStats.bind(monitoringService)
  };
}

/**
 * Global monitoring setup
 */
export function useGlobalMonitoring() {
  useEffect(() => {
    // Make monitoring service available globally for error boundaries
    if (typeof window !== 'undefined') {
      (window as any).monitoringService = monitoringService;
    }

    // Record app startup
    monitoringService.recordUsage({
      feature: 'app',
      action: 'startup',
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    });

    // Monitor DMX updates via store
    // This is a simplified approach - in production, you'd want to intercept at the store level
    const interval = setInterval(() => {
      const stats = monitoringService.getDmxTrafficStats(60000); // Last minute
      if (stats.totalUpdates > 0) {
        // Log high traffic
        if (stats.updatesPerSecond > 100) {
          console.warn(`[Monitoring] High DMX traffic: ${stats.updatesPerSecond.toFixed(1)} updates/sec`);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        delete (window as any).monitoringService;
      }
    };
  }, []);
}

