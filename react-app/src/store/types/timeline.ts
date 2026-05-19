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

export interface TimelineState {
  timelineSequences: TimelineSequence[];
  activeTimelineSequence: string | null;
  timelinePlayback: {
    active: boolean;
    sequenceId: string | null;
    startTime: number | null;
    position: number;
    loop: boolean;
    speed: number;
    direction: 'forward' | 'reverse';
    pingPong: boolean;
    pingPongDirection: 'forward' | 'reverse';
  };
}

export interface TimelineActions {
  loadTimelineSequence: (sequenceId: string) => void;
  deleteTimelineSequence: (sequenceId: string) => void;
  updateTimelineSequence: (sequenceId: string, updates: Partial<TimelineSequence>) => void;
  playTimelineSequence: (sequenceId: string, options?: {
    speed?: number;
    loop?: boolean;
    direction?: 'forward' | 'reverse';
    pingPong?: boolean;
  }) => void;
  stopTimelinePlayback: () => void;
  createTimelineFromPreset: (name: string, duration: number) => string;
  setTimelineLooping: (loop: boolean) => void;
  setTimelineSpeed: (speed: number) => void;
  setTimelineDirection: (direction: 'forward' | 'reverse') => void;
  setTimelinePingPong: (enabled: boolean) => void;
  seekTimeline: (position: number) => void;
}
