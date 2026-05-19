/**
 * DMX Update Optimizer
 * Throttles and batches DMX updates using requestAnimationFrame
 * and change detection to minimize backend calls
 */

export interface DmxUpdate {
  channel: number;
  value: number;
  timestamp: number;
}

export interface DmxOptimizerOptions {
  maxUpdatesPerFrame?: number;
  throttleMs?: number;
  changeThreshold?: number;
  batchSize?: number;
}

class DmxOptimizer {
  private pendingUpdates: Map<number, number> = new Map();
  private lastSentValues: Map<number, number> = new Map();
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  
  private options: Required<DmxOptimizerOptions>;
  private updateCallback: (updates: Record<number, number>) => void | Promise<void>;

  constructor(
    updateCallback: (updates: Record<number, number>) => void | Promise<void>,
    options: DmxOptimizerOptions = {}
  ) {
    this.updateCallback = updateCallback;
    this.options = {
      maxUpdatesPerFrame: options.maxUpdatesPerFrame ?? 512,
      throttleMs: options.throttleMs ?? 16, // ~60fps
      changeThreshold: options.changeThreshold ?? 1, // Minimum change to send
      batchSize: options.batchSize ?? 512
    };
  }

  /**
   * Queue a DMX channel update
   */
  queueUpdate(channel: number, value: number): void {
    // Check if value actually changed significantly
    const lastValue = this.lastSentValues.get(channel);
    if (lastValue !== undefined) {
      const change = Math.abs(value - lastValue);
      if (change < this.options.changeThreshold) {
        // Change too small, ignore
        return;
      }
    }

    // Store the update (will overwrite previous pending update for same channel)
    this.pendingUpdates.set(channel, value);

    // Schedule flush if not already scheduled
    this.scheduleFlush();
  }

  /**
   * Queue multiple DMX channel updates
   */
  queueUpdates(updates: Record<number, number>): void {
    let hasChanges = false;
    
    for (const [channelStr, value] of Object.entries(updates)) {
      const channel = Number(channelStr);
      
      // Check if value actually changed significantly
      const lastValue = this.lastSentValues.get(channel);
      if (lastValue !== undefined) {
        const change = Math.abs(value - lastValue);
        if (change < this.options.changeThreshold) {
          continue; // Change too small, skip
        }
      }

      this.pendingUpdates.set(channel, value);
      hasChanges = true;
    }

    if (hasChanges) {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush on the next animation frame
   */
  private scheduleFlush(): void {
    if (this.animationFrameId !== null) {
      return; // Already scheduled
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.flush();
    });
  }

  /**
   * Flush pending updates to the callback
   */
  private flush(): void {
    this.animationFrameId = null;
    
    const now = performance.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // Throttle updates
    if (timeSinceLastUpdate < this.options.throttleMs && this.pendingUpdates.size > 0) {
      // Reschedule for later
      this.animationFrameId = requestAnimationFrame(() => {
        this.flush();
      });
      return;
    }

    if (this.pendingUpdates.size === 0) {
      return;
    }

    // Convert pending updates to batch format
    const updates: Record<number, number> = {};
    let updateCount = 0;

    for (const [channel, value] of this.pendingUpdates.entries()) {
      if (updateCount >= this.options.maxUpdatesPerFrame) {
        break; // Limit updates per frame
      }

      updates[channel] = value;
      this.lastSentValues.set(channel, value);
      updateCount++;
    }

    // Clear processed updates
    this.pendingUpdates.clear();

    // Send updates
    if (Object.keys(updates).length > 0) {
      this.updateCallback(updates);
      this.lastUpdateTime = now;
    }

    // If there are still pending updates, schedule another flush
    if (this.pendingUpdates.size > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Force immediate flush of all pending updates
   */
  flushImmediate(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.pendingUpdates.size === 0) {
      return;
    }

    const updates: Record<number, number> = {};
    for (const [channel, value] of this.pendingUpdates.entries()) {
      updates[channel] = value;
      this.lastSentValues.set(channel, value);
    }

    this.pendingUpdates.clear();
    this.updateCallback(updates);
    this.lastUpdateTime = performance.now();
  }

  /**
   * Clear all pending updates
   */
  clear(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.pendingUpdates.clear();
  }

  /**
   * Reset the optimizer state
   */
  reset(): void {
    this.clear();
    this.lastSentValues.clear();
    this.lastUpdateTime = 0;
  }

  /**
   * Get current pending update count
   */
  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<DmxOptimizerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export default DmxOptimizer;

