/**
 * Monitoring & Analytics Utilities
 * Provides performance monitoring, error tracking, usage analytics, DMX traffic dashboard
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface ErrorEvent {
  message: string;
  stack?: string;
  component?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DmxTrafficMetric {
  universe: number;
  channel: number;
  value: number;
  timestamp: number;
  source: 'manual' | 'scene' | 'automation' | 'midi' | 'osc';
}

export interface UsageAnalytics {
  feature: string;
  action: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private performanceMetrics: PerformanceMetric[] = [];
  private errorEvents: ErrorEvent[] = [];
  private dmxTraffic: DmxTrafficMetric[] = [];
  private usageAnalytics: UsageAnalytics[] = [];
  private maxStorageSize = 10000; // Max items to keep in memory

  /**
   * Record performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    };

    this.performanceMetrics.push(fullMetric);
    
    // Keep only recent metrics
    if (this.performanceMetrics.length > this.maxStorageSize) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxStorageSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metric.name}: ${metric.value}${metric.unit}`);
    }
  }

  /**
   * Record error event
   */
  recordError(error: Omit<ErrorEvent, 'timestamp'>): void {
    const fullError: ErrorEvent = {
      ...error,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    this.errorEvents.push(fullError);
    
    // Keep only recent errors
    if (this.errorEvents.length > this.maxStorageSize) {
      this.errorEvents = this.errorEvents.slice(-this.maxStorageSize);
    }

    // Log to console
    console.error('[Error Tracking]', fullError);
  }

  /**
   * Record DMX traffic
   */
  recordDmxTraffic(traffic: Omit<DmxTrafficMetric, 'timestamp'>): void {
    const fullTraffic: DmxTrafficMetric = {
      ...traffic,
      timestamp: Date.now()
    };

    this.dmxTraffic.push(fullTraffic);
    
    // Keep only recent traffic (last 1000 updates)
    if (this.dmxTraffic.length > 1000) {
      this.dmxTraffic = this.dmxTraffic.slice(-1000);
    }
  }

  /**
   * Record usage analytics
   */
  recordUsage(analytics: Omit<UsageAnalytics, 'timestamp'>): void {
    const fullAnalytics: UsageAnalytics = {
      ...analytics,
      timestamp: Date.now()
    };

    this.usageAnalytics.push(fullAnalytics);
    
    // Keep only recent analytics
    if (this.usageAnalytics.length > this.maxStorageSize) {
      this.usageAnalytics = this.usageAnalytics.slice(-this.maxStorageSize);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(timeRange?: number): PerformanceMetric[] {
    if (!timeRange) {
      return [...this.performanceMetrics];
    }
    const cutoff = Date.now() - timeRange;
    return this.performanceMetrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get error events
   */
  getErrors(timeRange?: number): ErrorEvent[] {
    if (!timeRange) {
      return [...this.errorEvents];
    }
    const cutoff = Date.now() - timeRange;
    return this.errorEvents.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Get DMX traffic
   */
  getDmxTraffic(timeRange?: number): DmxTrafficMetric[] {
    if (!timeRange) {
      return [...this.dmxTraffic];
    }
    const cutoff = Date.now() - timeRange;
    return this.dmxTraffic.filter(t => t.timestamp >= cutoff);
  }

  /**
   * Get usage analytics
   */
  getUsage(timeRange?: number): UsageAnalytics[] {
    if (!timeRange) {
      return [...this.usageAnalytics];
    }
    const cutoff = Date.now() - timeRange;
    return this.usageAnalytics.filter(u => u.timestamp >= cutoff);
  }

  /**
   * Get DMX traffic statistics
   */
  getDmxTrafficStats(timeRange: number = 60000): {
    totalUpdates: number;
    updatesPerSecond: number;
    channelsActive: number;
    universeBreakdown: Record<number, number>;
    sourceBreakdown: Record<string, number>;
  } {
    const traffic = this.getDmxTraffic(timeRange);
    const channels = new Set<string>();
    const universeCounts: Record<number, number> = {};
    const sourceCounts: Record<string, number> = {};

    traffic.forEach(t => {
      channels.add(`${t.universe}-${t.channel}`);
      universeCounts[t.universe] = (universeCounts[t.universe] || 0) + 1;
      sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1;
    });

    return {
      totalUpdates: traffic.length,
      updatesPerSecond: traffic.length / (timeRange / 1000),
      channelsActive: channels.size,
      universeBreakdown: universeCounts,
      sourceBreakdown: sourceCounts
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.performanceMetrics = [];
    this.errorEvents = [];
    this.dmxTraffic = [];
    this.usageAnalytics = [];
  }

  /**
   * Export data for analysis
   */
  exportData(): string {
    return JSON.stringify({
      metrics: this.performanceMetrics,
      errors: this.errorEvents,
      traffic: this.dmxTraffic,
      usage: this.usageAnalytics,
      exportedAt: Date.now()
    }, null, 2);
  }
}

/**
 * Global monitoring service instance
 */
export const monitoringService = new MonitoringService();

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string, enabled: boolean = true) {
  React.useEffect(() => {
    if (!enabled || typeof performance === 'undefined') return;

    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

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
  });
}

// Import React for hook
import React from 'react';

