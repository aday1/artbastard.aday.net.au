import { SceneTimelineKeyframe } from '../store';

/**
 * Convert time in milliseconds to pixel position
 */
export function timeToPixels(time: number, zoom: number): number {
  return (time / 1000) * zoom;
}

/**
 * Convert pixel position to time in milliseconds
 */
export function pixelsToTime(pixels: number, zoom: number): number {
  return (pixels / zoom) * 1000;
}

/**
 * Format time for display
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100)}`;
  }
  return `${seconds}.${Math.floor(milliseconds / 100)}`;
}

/**
 * Format time as bars/beats (for BPM sync)
 */
export function formatBarsBeats(ms: number, bpm: number, beatsPerBar: number = 4): string {
  const beats = (ms / 1000) * (bpm / 60);
  const bars = Math.floor(beats / beatsPerBar) + 1;
  const beat = (Math.floor(beats % beatsPerBar) + 1);
  const subBeat = Math.floor((beats % 1) * 4) + 1;
  return `${bars}.${beat}.${subBeat}`;
}

/**
 * Interpolate value between two keyframes
 */
export function interpolateValue(
  keyframes: SceneTimelineKeyframe[],
  time: number,
  channel: number
): number | undefined {
  if (keyframes.length === 0) return undefined;
  
  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  
  // Find surrounding keyframes
  let before: SceneTimelineKeyframe | null = null;
  let after: SceneTimelineKeyframe | null = null;
  
  for (let i = 0; i < sorted.length; i++) {
    const kf = sorted[i];
    const value = kf.channelValues[channel];
    
    if (value === undefined) continue;
    
    if (kf.time <= time) {
      before = kf;
    }
    if (kf.time >= time && !after) {
      after = kf;
      break;
    }
  }
  
  // No keyframes with this channel
  if (!before && !after) return undefined;
  
  // Exact match or before first keyframe
  if (before && before.time === time) return before.channelValues[channel];
  if (before && !after) return before.channelValues[channel];
  if (!before && after) return after.channelValues[channel];
  
  // Interpolate between keyframes
  if (before && after) {
    const t = (time - before.time) / (after.time - before.time);
    const beforeValue = before.channelValues[channel] || 0;
    const afterValue = after.channelValues[channel] || 0;
    
    // Apply easing
    const easing = before.easing || 'linear';
    const easedT = applyEasing(t, easing);
    
    return Math.round(beforeValue + (afterValue - beforeValue) * easedT);
  }
  
  return undefined;
}

/**
 * Apply easing function to t value (0-1)
 */
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'smooth':
      return t * t * (3 - 2 * t); // Smoothstep
    case 'step':
      return t < 1 ? 0 : 1;
    default:
      return t; // linear
  }
}

/**
 * Get all channels used in keyframes
 */
export function getChannelsFromKeyframes(keyframes: SceneTimelineKeyframe[]): number[] {
  const channels = new Set<number>();
  keyframes.forEach(kf => {
    Object.keys(kf.channelValues).forEach(ch => channels.add(Number(ch)));
  });
  return Array.from(channels).sort((a, b) => a - b);
}

/**
 * Snap time to grid
 */
export function snapToGrid(time: number, gridInterval: number): number {
  return Math.round(time / gridInterval) * gridInterval;
}

/**
 * Calculate grid interval based on zoom level
 */
export function calculateGridInterval(zoom: number, bpm?: number): number {
  if (bpm && bpm > 0) {
    // Snap to beat divisions
    const beatMs = (60 / bpm) * 1000;
    const pixelsPerBeat = timeToPixels(beatMs, zoom);
    
    if (pixelsPerBeat > 200) return beatMs / 4; // 16th notes
    if (pixelsPerBeat > 100) return beatMs / 2; // 8th notes
    return beatMs; // Quarter notes
  }
  
  // Time-based grid
  if (zoom > 100) return 100; // 100ms
  if (zoom > 50) return 500; // 500ms
  if (zoom > 20) return 1000; // 1 second
  return 5000; // 5 seconds
}

/**
 * Generate curve path for SVG
 */
export function generateCurvePath(
  keyframes: SceneTimelineKeyframe[],
  channel: number,
  startTime: number,
  endTime: number,
  zoom: number,
  height: number
): string {
  const sorted = keyframes
    .filter(kf => kf.channelValues[channel] !== undefined)
    .sort((a, b) => a.time - b.time)
    .filter(kf => kf.time >= startTime && kf.time <= endTime);
  
  if (sorted.length === 0) return '';
  if (sorted.length === 1) {
    const kf = sorted[0];
    const x = timeToPixels(kf.time - startTime, zoom);
    const y = height - (kf.channelValues[channel]! / 255) * height;
    return `M ${x} ${y} L ${x} ${y}`;
  }
  
  const points = sorted.map(kf => {
    const x = timeToPixels(kf.time - startTime, zoom);
    const y = height - (kf.channelValues[channel]! / 255) * height;
    return { x, y, time: kf.time, value: kf.channelValues[channel]!, easing: kf.easing || 'linear' };
  });
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    if (prev.easing === 'step') {
      // Step: horizontal line then vertical
      path += ` L ${curr.x} ${prev.y} L ${curr.x} ${curr.y}`;
    } else if (prev.easing === 'linear') {
      // Linear: straight line
      path += ` L ${curr.x} ${curr.y}`;
    } else {
      // Smooth curves using quadratic bezier
      const midX = (prev.x + curr.x) / 2;
      path += ` Q ${midX} ${prev.y} ${curr.x} ${curr.y}`;
    }
  }
  
  return path;
}

/**
 * Check if keyframe is within visible time range
 */
export function isKeyframeVisible(
  keyframe: SceneTimelineKeyframe,
  startTime: number,
  endTime: number
): boolean {
  return keyframe.time >= startTime && keyframe.time <= endTime;
}

/**
 * Get keyframe value for a specific channel
 */
export function getKeyframeValue(
  keyframe: SceneTimelineKeyframe,
  channel: number
): number | undefined {
  return keyframe.channelValues[channel];
}

/**
 * Calculate track height based on zoom
 */
export function calculateTrackHeight(zoom: number, minHeight: number = 60, maxHeight: number = 200): number {
  // Track height scales with zoom for better visibility
  const baseHeight = minHeight;
  const zoomMultiplier = Math.min(zoom / 30, 2); // Cap at 2x
  return Math.min(baseHeight * zoomMultiplier, maxHeight);
}

