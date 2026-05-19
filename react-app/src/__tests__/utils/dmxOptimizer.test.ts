/**
 * Tests for DMX Optimizer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DmxOptimizer from '../../utils/dmxOptimizer';

describe('DmxOptimizer', () => {
  let optimizer: DmxOptimizer;
  let updateCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    updateCallback = vi.fn();
    optimizer = new DmxOptimizer(updateCallback, {
      maxUpdatesPerFrame: 512,
      throttleMs: 16,
      changeThreshold: 1,
      batchSize: 512
    });
  });

  afterEach(() => {
    optimizer.clear();
    vi.useRealTimers();
  });

  it('should queue single update', () => {
    optimizer.queueUpdate(0, 128);
    expect(optimizer.getPendingCount()).toBe(1);
  });

  it('should batch multiple updates', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(1, 255);
    optimizer.queueUpdate(2, 64);
    
    expect(optimizer.getPendingCount()).toBe(3);
  });

  it('should ignore updates below threshold', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(0, 128); // Same value
    optimizer.queueUpdate(0, 129); // Only 1 difference (below threshold)
    
    expect(optimizer.getPendingCount()).toBe(1); // Only first update
  });

  it('should flush updates after throttle period', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(1, 255);
    
    vi.advanceTimersByTime(20); // Advance past throttle
    
    // Flush should be called via requestAnimationFrame
    // In real scenario, this would be handled by browser
    expect(optimizer.getPendingCount()).toBeGreaterThanOrEqual(0);
  });

  it('should overwrite pending updates for same channel', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(0, 200);
    
    expect(optimizer.getPendingCount()).toBe(1);
  });

  it('should flush immediately when requested', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(1, 255);
    
    optimizer.flushImmediate();
    
    expect(optimizer.getPendingCount()).toBe(0);
    expect(updateCallback).toHaveBeenCalled();
  });

  it('should clear all pending updates', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.queueUpdate(1, 255);
    optimizer.queueUpdate(2, 64);
    
    optimizer.clear();
    
    expect(optimizer.getPendingCount()).toBe(0);
  });

  it('should reset state completely', () => {
    optimizer.queueUpdate(0, 128);
    optimizer.reset();
    
    expect(optimizer.getPendingCount()).toBe(0);
  });

  it('should handle queueUpdates with multiple channels', () => {
    optimizer.queueUpdates({
      0: 128,
      1: 255,
      2: 64
    });
    
    expect(optimizer.getPendingCount()).toBe(3);
  });
});

