// Timeline Types and Interfaces
export interface TimelineKeyframe {
  time: number;
  value: number;
  curve: 'linear' | 'smooth' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  controlPoint1?: { x: number; y: number };
  controlPoint2?: { x: number; y: number };
}

export interface TimelineSequence {
  id: string;
  name: string;
  description?: string;
  duration: number;
  channels: Array<{
    channel: number;
    keyframes: TimelineKeyframe[];
  }>;
  tags?: string[];
  createdAt: number;
  modifiedAt: number;
}

// Initial Timeline Sequences
export const initialTimelineSequences: TimelineSequence[] = [
  {
    id: 'moving-head-example',
    name: 'Example: Moving Head Pan/Tilt',
    description: 'A smooth figure-eight pattern using pan and tilt channels',
    duration: 10000, // 10 seconds
    channels: [
      {
        channel: 1, // Pan channel
        keyframes: [
          { time: 0, value: 0, curve: 'smooth' },
          { time: 2500, value: 255, curve: 'smooth' },
          { time: 5000, value: 0, curve: 'smooth' },
          { time: 7500, value: 255, curve: 'smooth' },
          { time: 10000, value: 0, curve: 'smooth' }
        ]
      },
      {
        channel: 2, // Tilt channel
        keyframes: [
          { time: 0, value: 127, curve: 'smooth' },
          { time: 2500, value: 255, curve: 'smooth' },
          { time: 5000, value: 127, curve: 'smooth' },
          { time: 7500, value: 0, curve: 'smooth' },
          { time: 10000, value: 127, curve: 'smooth' }
        ]
      }
    ],
    tags: ['example', 'moving head', 'pan/tilt'],
    createdAt: Date.now(),
    modifiedAt: Date.now()
  },
  {
    id: 'blank-timeline',
    name: 'Blank Timeline',
    description: 'A fresh timeline ready for your creativity',
    duration: 5000, // 5 seconds
    channels: [], // No channels initially
    tags: ['template'],
    createdAt: Date.now(),
    modifiedAt: Date.now()
  }
];

// Helper function for value interpolation
export function interpolateValue(keyframes: TimelineKeyframe[], time: number): number | undefined {
  if (keyframes.length === 0) return undefined;
  if (keyframes.length === 1) return keyframes[0].value;

  // Find surrounding keyframes
  let prevFrame = keyframes[0];
  let nextFrame = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].time <= time && keyframes[i + 1].time > time) {
      prevFrame = keyframes[i];
      nextFrame = keyframes[i + 1];
      break;
    }
  }

  if (prevFrame === nextFrame) return prevFrame.value;

  const progress = (time - prevFrame.time) / (nextFrame.time - prevFrame.time);

  switch (prevFrame.curve) {
    case 'step':
      return prevFrame.value;
    
    case 'linear':
      return prevFrame.value + (nextFrame.value - prevFrame.value) * progress;
    
    case 'smooth':
      const t = progress * progress * (3 - 2 * progress);
      return prevFrame.value + (nextFrame.value - prevFrame.value) * t;
    
    case 'ease-in':
      const ti = progress * progress;
      return prevFrame.value + (nextFrame.value - prevFrame.value) * ti;
    
    case 'ease-out':
      const to = 1 - Math.pow(1 - progress, 2);
      return prevFrame.value + (nextFrame.value - prevFrame.value) * to;
    
    case 'ease-in-out':
      const tio = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      return prevFrame.value + (nextFrame.value - prevFrame.value) * tio;
    
    default:
      return prevFrame.value + (nextFrame.value - prevFrame.value) * progress;
  }
}
